"""HID device discovery, report parsing, and LED output for the MK3."""
import glob
import os

VENDOR_ID = "17CC"
PRODUCT_ID = "1600"

BUTTONS = {
    "navPush":        (0x01, 0x01),
    "navUp":          (0x01, 0x04),
    "navRight":       (0x01, 0x08),
    "navDown":        (0x01, 0x10),
    "navLeft":        (0x01, 0x20),
    "shift":          (0x01, 0x40),
    "d8":             (0x01, 0x80),
    "g1":             (0x02, 0x01), "g2": (0x02, 0x02), "g3": (0x02, 0x04), "g4": (0x02, 0x08),
    "g5":             (0x02, 0x10), "g6": (0x02, 0x20), "g7": (0x02, 0x40), "g8": (0x02, 0x80),
    "notes":          (0x03, 0x01), "volume": (0x03, 0x02), "swing": (0x03, 0x04),
    "tempo":          (0x03, 0x08), "noteRepeatArp": (0x03, 0x10), "lock": (0x03, 0x20),
    "padMode":        (0x04, 0x01), "keyboard": (0x04, 0x02), "chords": (0x04, 0x04),
    "step":           (0x04, 0x08), "fixedVel": (0x04, 0x10), "scene": (0x04, 0x20),
    "pattern":        (0x04, 0x40), "events": (0x04, 0x80),
    "variationNavigate": (0x05, 0x02), "duplicateDouble": (0x05, 0x04),
    "select":         (0x05, 0x08), "solo": (0x05, 0x10), "muteChoke": (0x05, 0x20),
    "pitch":          (0x05, 0x40), "mod": (0x05, 0x80),
    "performFxSelect":(0x06, 0x01), "restartLoop": (0x06, 0x02), "eraseReplace": (0x06, 0x04),
    "tapMetro":       (0x06, 0x08), "followGrid": (0x06, 0x10), "play": (0x06, 0x20),
    "recCountIn":     (0x06, 0x40), "stop": (0x06, 0x80),
    "macroSet":       (0x07, 0x01), "settings": (0x07, 0x02), "arrowRight": (0x07, 0x04),
    "sampling":       (0x07, 0x08), "mixer": (0x07, 0x10), "plugin": (0x07, 0x20),
    "channelMidi":    (0x08, 0x01), "arranger": (0x08, 0x02), "browserPlugin": (0x08, 0x04),
    "arrowLeft":      (0x08, 0x08), "fileSave": (0x08, 0x10), "auto": (0x08, 0x20),
    "d1":             (0x09, 0x01), "d2": (0x09, 0x02), "d3": (0x09, 0x04), "d4": (0x09, 0x08),
    "d5":             (0x09, 0x10), "d6": (0x09, 0x20), "d7": (0x09, 0x40),
}

KNOBS = {
    "k1": (12, 13), "k2": (14, 15), "k3": (16, 17), "k4": (18, 19),
    "k5": (20, 21), "k6": (22, 23), "k7": (24, 25), "k8": (26, 27),
}

STEPPER_BYTE = 11

LEDS = {
    "settings":    (0x80, 10),
    "d1": (0x80, 13), "d2": (0x80, 14), "d3": (0x80, 15), "d4": (0x80, 16),
    "d5": (0x80, 17), "d6": (0x80, 18), "d7": (0x80, 19), "d8": (0x80, 20),
    "arrowLeft":   (0x80, 7), "arrowRight": (0x80, 8),
}

LED_REPORT_80_SIZE = 63
LED_REPORT_81_SIZE = 43


def find_hidraw(device_path=None):
    if device_path:
        return device_path
    for hidraw in sorted(glob.glob("/dev/hidraw*")):
        try:
            devnum = hidraw.replace("/dev/hidraw", "")
            uevent = f"/sys/class/hidraw/hidraw{devnum}/device/uevent"
            if os.path.exists(uevent):
                with open(uevent) as f:
                    content = f.read().upper()
                    if VENDOR_ID in content and PRODUCT_ID in content:
                        return hidraw
        except (IOError, OSError):
            continue
    return None


def open_hidraw(path):
    return os.open(path, os.O_RDWR | os.O_NONBLOCK)


def read_report(fd):
    try:
        return os.read(fd, 64)
    except BlockingIOError:
        return None
    except OSError:
        return None


def parse_buttons(curr, prev):
    pressed = set()
    released = set()
    for name, (byte_idx, mask) in BUTTONS.items():
        if byte_idx >= len(curr) or byte_idx >= len(prev):
            continue
        is_on = (curr[byte_idx] & mask) != 0
        was_on = (prev[byte_idx] & mask) != 0
        if is_on and not was_on:
            pressed.add(name)
        elif was_on and not is_on:
            released.add(name)
    return pressed, released


def parse_knob(curr, prev, knob_name):
    lsb, msb = KNOBS[knob_name]
    if msb >= len(curr) or msb >= len(prev):
        return 0
    curr_val = curr[lsb] | (curr[msb] << 8)
    prev_val = prev[lsb] | (prev[msb] << 8)
    delta = curr_val - prev_val
    if delta > 32768:
        delta -= 65536
    elif delta < -32768:
        delta += 65536
    return delta


def parse_stepper(curr, prev):
    if STEPPER_BYTE >= len(curr) or STEPPER_BYTE >= len(prev):
        return 0
    curr_pos = curr[STEPPER_BYTE] & 0x0F
    prev_pos = prev[STEPPER_BYTE] & 0x0F
    if curr_pos == prev_pos:
        return 0
    diff = (curr_pos - prev_pos) & 0x0F
    if diff <= 7:
        return 1
    return -1


class LedWriter:
    def __init__(self, fd):
        self._fd = fd
        self._buf80 = bytearray(LED_REPORT_80_SIZE)
        self._buf80[0] = 0x80
        self._buf81 = bytearray(LED_REPORT_81_SIZE)
        self._buf81[0] = 0x81

    def set_led(self, name, value):
        if name not in LEDS:
            return
        report_id, offset = LEDS[name]
        if report_id == 0x80:
            self._buf80[offset] = value
        else:
            self._buf81[offset] = value

    def send(self):
        try:
            os.write(self._fd, bytes(self._buf80))
            os.write(self._fd, bytes(self._buf81))
        except OSError:
            pass

    def all_off(self):
        for i in range(1, LED_REPORT_80_SIZE):
            self._buf80[i] = 0
        for i in range(1, LED_REPORT_81_SIZE):
            self._buf81[i] = 0
