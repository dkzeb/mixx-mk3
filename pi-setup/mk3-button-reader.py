#!/usr/bin/env python3
"""Read MK3 HID buttons and send keyboard events via xdotool.

Runs as a background process during dialogs/menus.
Maps MK3 buttons to keyboard events for zenity interaction.

Usage: python3 mk3-button-reader.py &
"""
import os
import sys
import subprocess
import glob
import time

# MK3 button positions in Report 0x01: (byte_index, bitmask, xdotool_key)
BUTTONS = {
    "play":     (0x06, 0x20, "Return"),
    "stop":     (0x06, 0x80, "Escape"),
    "navPush":  (0x01, 0x01, "Return"),
    "navUp":    (0x01, 0x04, "Up"),
    "navDown":  (0x01, 0x10, "Down"),
    "navLeft":  (0x01, 0x20, "Left"),
    "navRight": (0x01, 0x08, "Right"),
}

VENDOR_ID = "17CC"
PRODUCT_ID = "1600"


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
    return "/dev/hidraw0"


def main():
    display = os.environ.get("DISPLAY", ":99")
    hidraw = find_mk3_hidraw()

    try:
        fd = os.open(hidraw, os.O_RDONLY)
    except OSError as e:
        print(f"mk3-button-reader: cannot open {hidraw}: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"mk3-button-reader: listening on {hidraw}", file=sys.stderr)
    last_state = {}

    try:
        while True:
            try:
                data = os.read(fd, 64)
            except OSError:
                time.sleep(0.05)
                continue

            if len(data) < 7 or data[0] != 0x01:
                continue

            for name, (byte_idx, mask, key) in BUTTONS.items():
                if byte_idx >= len(data):
                    continue
                pressed = (data[byte_idx] & mask) != 0
                was_pressed = last_state.get(name, False)

                if pressed and not was_pressed:
                    subprocess.Popen(
                        ["xdotool", "key", "--clearmodifiers", key],
                        env={**os.environ, "DISPLAY": display},
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    print(f"mk3-button-reader: {name} -> {key}", file=sys.stderr)

                last_state[name] = pressed

    except KeyboardInterrupt:
        pass
    finally:
        os.close(fd)


if __name__ == "__main__":
    main()
