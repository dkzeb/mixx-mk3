#!/usr/bin/env python3
"""T9 text input daemon for NI Maschine MK3.

Reads pad presses from hidraw, drives pad LEDs, and injects keystrokes
via xdotool to control Mixxx's library search. Runs as a systemd
service alongside Mixxx.

Toggle T9 mode with the browserPlugin button (byte 0x08, mask 0x04).
"""
import importlib.util
import glob
import os
import subprocess
import sys
import time

# ---------------------------------------------------------------------------
# Import T9Engine from the hyphenated sibling file
# ---------------------------------------------------------------------------
_spec = importlib.util.spec_from_file_location(
    "mk3_t9_engine",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "mk3-t9-engine.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
T9Engine = _mod.T9Engine
CHAR_MAP = _mod.CHAR_MAP
PAD_ENTER = _mod.PAD_ENTER
PAD_TAB = _mod.PAD_TAB
PAD_CLEAR = _mod.PAD_CLEAR
PAD_BACKSPACE = _mod.PAD_BACKSPACE

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VENDOR_ID = "17CC"
PRODUCT_ID = "1600"

LOG_PREFIX = "mk3-t9-daemon"

# browserPlugin button: Report 0x01, byte 0x08, mask 0x04
TOGGLE_BYTE = 0x08
TOGGLE_MASK = 0x04

# settings button: Report 0x01, byte 0x07, mask 0x02
SETTINGS_BYTE = 0x07
SETTINGS_MASK = 0x02

# Mouse mode toggle: Auto (0x08, 0x20) + Macro (0x07, 0x01)
MOUSE_AUTO_BYTE = 0x08
MOUSE_AUTO_MASK = 0x20
MOUSE_MACRO_BYTE = 0x07
MOUSE_MACRO_MASK = 0x01

# Pad HID report
PAD_REPORT_ID = 0x02
PAD_PRESSURE_THRESHOLD = 256
PAD_COUNT = 16
# Hardware index -> physical pad (1-16)
HW_TO_PHYSICAL = [13, 14, 15, 16, 9, 10, 11, 12, 5, 6, 7, 8, 1, 2, 3, 4]

# LED output report 0x81 — 43 bytes total (1 byte report ID + 42 data)
LED_REPORT_ID = 0x81
LED_REPORT_SIZE = 43

# Physical pad -> byte offset in report 0x81
PAD_LED_OFFSET = {
    1: 38, 2: 39, 3: 40, 4: 41,      # bottom row (p13-p16)
    5: 34, 6: 35, 7: 36, 8: 37,      # row 2 (p9-p12)
    9: 30, 10: 31, 11: 32, 12: 33,   # row 3 (p5-p8)
    13: 26, 14: 27, 15: 28, 16: 29,  # top row (p1-p4)
}

# Indexed color palette
COLOR_OFF = 0
COLOR_RED = 4
COLOR_GREEN = 20
COLOR_CYAN = 32
COLOR_BLUE = 40
COLOR_WHITE = 68


# ---------------------------------------------------------------------------
# LedWriter
# ---------------------------------------------------------------------------
class LedWriter:
    """Builds and sends LED Report 0x81 over hidraw."""

    def __init__(self, fd):
        self._fd = fd
        self._buf = bytearray(LED_REPORT_SIZE)
        self._buf[0] = LED_REPORT_ID

    def set_pad(self, physical, color):
        """Set a pad LED by physical index (1-16) to an indexed color."""
        offset = PAD_LED_OFFSET.get(physical)
        if offset is not None:
            self._buf[offset] = color

    def all_off(self):
        """Turn all pad LEDs off."""
        for phys in range(1, PAD_COUNT + 1):
            self.set_pad(phys, COLOR_OFF)

    def set_t9_layout(self, active_pad=None):
        """Set the standard T9 LED layout.

        Character pads are CYAN (or WHITE if currently cycling),
        plus the special-function pads.
        """
        for phys in range(1, PAD_COUNT + 1):
            if phys in CHAR_MAP:
                if phys == active_pad:
                    self.set_pad(phys, COLOR_WHITE)
                else:
                    self.set_pad(phys, COLOR_CYAN)
            elif phys == PAD_ENTER:
                self.set_pad(phys, COLOR_GREEN)
            elif phys == PAD_CLEAR:
                self.set_pad(phys, COLOR_RED)
            elif phys == PAD_TAB:
                self.set_pad(phys, COLOR_BLUE)
            elif phys == PAD_BACKSPACE:
                self.set_pad(phys, COLOR_WHITE)
            else:
                self.set_pad(phys, COLOR_OFF)

    def send(self):
        """Write the LED report to the hidraw device."""
        try:
            os.write(self._fd, bytes(self._buf))
        except OSError as e:
            print(f"{LOG_PREFIX}: LED write error: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# XdotoolSearchBridge
# ---------------------------------------------------------------------------
class XdotoolSearchBridge:
    """Injects keystrokes via xdotool for Mixxx library search."""

    def __init__(self, display=":99"):
        self._env = {**os.environ, "DISPLAY": display}

    def _run(self, *args, wait=False):
        p = subprocess.Popen(
            list(args),
            env=self._env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if wait:
            p.wait()

    def type_text(self, text):
        """Select all then type the full text (replaces previous content).

        The JS mapping focuses the search box via engine.setValue, so we
        just need to clear and retype.
        """
        self._run("xdotool", "key", "--clearmodifiers", "ctrl+a", wait=True)
        if text:
            self._run("xdotool", "type", "--clearmodifiers", "--delay", "0", text)
        else:
            self._run("xdotool", "key", "--clearmodifiers", "Delete")

    def confirm_search(self):
        """Move focus to results."""
        self._run("xdotool", "key", "--clearmodifiers", "Return")

    def tab_focus(self):
        """Toggle focus between search bar and track list."""
        self._run("xdotool", "key", "--clearmodifiers", "Tab")


# ---------------------------------------------------------------------------
# HID device discovery
# ---------------------------------------------------------------------------
def find_mk3_hidraw():
    """Find the hidraw device for the MK3 HID interface."""
    for hidraw in sorted(glob.glob("/dev/hidraw*")):
        try:
            devnum = hidraw.replace("/dev/hidraw", "")
            uevent_path = f"/sys/class/hidraw/hidraw{devnum}/device/uevent"
            if os.path.exists(uevent_path):
                with open(uevent_path) as f:
                    content = f.read().upper()
                    if VENDOR_ID in content and PRODUCT_ID in content:
                        return hidraw
        except (IOError, OSError):
            continue
    return None


# ---------------------------------------------------------------------------
# Pad pressure parsing
# ---------------------------------------------------------------------------
def parse_pad_report(data):
    """Parse Report 0x02 and return dict of {physical_pad: pressure}.

    Pad data starts at byte 1. Each entry is 3 bytes:
    hwIndex (1 byte), pressureLSB (1 byte), pressureMSB (1 byte).
    Max 21 entries, terminated when hwIndex == 0 or data runs out.
    """
    pads = {}
    offset = 1
    for _ in range(21):
        if offset + 3 > len(data):
            break
        hw_index = data[offset]
        if hw_index >= PAD_COUNT:
            break  # sentinel / end of list
        pressure = data[offset + 1] | (data[offset + 2] << 8)
        physical = HW_TO_PHYSICAL[hw_index]
        pads[physical] = pressure
        offset += 3
    return pads


# ---------------------------------------------------------------------------
# Main daemon loop
# ---------------------------------------------------------------------------
def main():
    display = os.environ.get("DISPLAY", ":99")
    bridge = XdotoolSearchBridge(display)

    while True:
        # Find and open hidraw device
        hidraw = find_mk3_hidraw()
        if hidraw is None:
            print(f"{LOG_PREFIX}: waiting for MK3 HID device...", file=sys.stderr)
            time.sleep(3)
            continue
        try:
            fd = os.open(hidraw, os.O_RDWR)
        except OSError:
            print(f"{LOG_PREFIX}: cannot open {hidraw}, retrying...", file=sys.stderr)
            time.sleep(3)
            continue

        print(f"{LOG_PREFIX}: listening on {hidraw}", file=sys.stderr)

        leds = LedWriter(fd)
        t9_active = False
        toggle_was_pressed = False
        settings_was_pressed = False
        mouse_auto_was = False
        mouse_macro_was = False
        pad_was_pressed = {}  # physical pad -> bool

        engine = None

        def deactivate_t9():
            nonlocal t9_active, engine
            t9_active = False
            engine = None
            leds.all_off()
            leds.send()
            pad_was_pressed.clear()

        def make_engine():
            def on_change(text):
                if not t9_active:
                    return
                bridge.type_text(text)
                leds.set_t9_layout(active_pad=engine.get_pending_pad() if engine else None)
                leds.send()

            def on_submit(text):
                print(f"{LOG_PREFIX}: submitted '{text}'", file=sys.stderr)
                deactivate_t9()
                bridge.confirm_search()

            def on_tab():
                print(f"{LOG_PREFIX}: tab focus", file=sys.stderr)
                bridge.tab_focus()

            return T9Engine(
                on_change=on_change,
                on_submit=on_submit,
                on_tab=on_tab,
            )

        try:
            while True:
                try:
                    data = os.read(fd, 64)
                except OSError:
                    time.sleep(0.05)
                    continue

                if not data:
                    continue

                report_id = data[0]

                # --- Report 0x01: check keyboard button ---
                if report_id == 0x01 and len(data) > TOGGLE_BYTE:
                    pressed = (data[TOGGLE_BYTE] & TOGGLE_MASK) != 0

                    if pressed and not toggle_was_pressed:
                        t9_active = not t9_active

                        if t9_active:
                            print(f"{LOG_PREFIX}: T9 mode ON", file=sys.stderr)
                            engine = make_engine()
                            leds.set_t9_layout()
                            leds.send()
                        else:
                            print(f"{LOG_PREFIX}: T9 mode OFF", file=sys.stderr)
                            if engine:
                                engine.reset()
                                engine = None
                            leds.all_off()
                            leds.send()
                            pad_was_pressed.clear()

                    toggle_was_pressed = pressed

                    # --- Settings button: deactivate T9 if active ---
                    settings_pressed = (data[SETTINGS_BYTE] & SETTINGS_MASK) != 0
                    if settings_pressed and not settings_was_pressed and t9_active:
                        print(f"{LOG_PREFIX}: settings pressed, deactivating T9", file=sys.stderr)
                        deactivate_t9()
                    settings_was_pressed = settings_pressed

                    # --- Mouse mode combo: deactivate T9 ---
                    m_auto = (data[MOUSE_AUTO_BYTE] & MOUSE_AUTO_MASK) != 0
                    m_macro = (data[MOUSE_MACRO_BYTE] & MOUSE_MACRO_MASK) != 0
                    m_auto_edge = m_auto and not mouse_auto_was
                    m_macro_edge = m_macro and not mouse_macro_was

                    if ((m_auto_edge and m_macro) or (m_macro_edge and m_auto)) and t9_active:
                        print(f"{LOG_PREFIX}: mouse combo pressed, deactivating T9", file=sys.stderr)
                        deactivate_t9()

                    mouse_auto_was = m_auto
                    mouse_macro_was = m_macro

                # --- Report 0x02: pad presses ---
                if report_id == PAD_REPORT_ID and t9_active and engine:
                    pads = parse_pad_report(data)

                    for phys in range(1, PAD_COUNT + 1):
                        pressure = pads.get(phys, 0)
                        is_pressed = pressure >= PAD_PRESSURE_THRESHOLD
                        was_pressed = pad_was_pressed.get(phys, False)
                        pad_was_pressed[phys] = is_pressed

                        if is_pressed and not was_pressed and engine:
                            engine.press(phys)
                            # engine may be None if press triggered submit/cancel
                            if engine:
                                leds.set_t9_layout(
                                    active_pad=engine.get_pending_pad()
                                )
                                leds.send()

                # --- Tick for timeout commits ---
                if t9_active and engine:
                    if engine.tick():
                        leds.set_t9_layout(
                            active_pad=engine.get_pending_pad()
                        )
                        leds.send()

        except OSError:
            print(f"{LOG_PREFIX}: HID read error, reconnecting...",
                  file=sys.stderr)
        finally:
            try:
                leds.all_off()
                leds.send()
            except OSError:
                pass
            os.close(fd)

        time.sleep(2)


if __name__ == "__main__":
    main()
