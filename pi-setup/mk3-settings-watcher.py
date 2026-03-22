#!/usr/bin/env python3
"""Background watcher for the MK3 settings button.

Reads HID reports and launches the settings menu when the settings
button is pressed. Runs as a systemd service alongside Mixxx.

The settings button is NOT handled by Mixxx's JS mapping, so there's
no conflict with both reading the same hidraw device.
"""
import os
import sys
import subprocess
import glob
import time

# Settings button: byte 0x07, mask 0x02
SETTINGS_BYTE = 0x07
SETTINGS_MASK = 0x02

VENDOR_ID = "17CC"
PRODUCT_ID = "1600"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MENU_SCRIPT = os.path.join(SCRIPT_DIR, "mk3-settings-menu.sh")


def find_mk3_hidraw():
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

    while True:
        try:
            fd = os.open(hidraw, os.O_RDONLY)
        except OSError:
            print("mk3-settings-watcher: waiting for HID device...", file=sys.stderr)
            time.sleep(3)
            continue

        print(f"mk3-settings-watcher: listening on {hidraw}", file=sys.stderr)
        was_pressed = False
        menu_active = False

        try:
            while True:
                try:
                    data = os.read(fd, 64)
                except OSError:
                    time.sleep(0.05)
                    continue

                if len(data) < 8 or data[0] != 0x01:
                    continue

                pressed = (data[SETTINGS_BYTE] & SETTINGS_MASK) != 0

                if pressed and not was_pressed and not menu_active:
                    print("mk3-settings-watcher: settings pressed, launching menu",
                          file=sys.stderr)
                    menu_active = True
                    proc = subprocess.Popen(
                        ["bash", MENU_SCRIPT],
                        env={**os.environ, "DISPLAY": display},
                    )
                    proc.wait()
                    menu_active = False
                    print("mk3-settings-watcher: menu closed", file=sys.stderr)

                was_pressed = pressed

        except OSError:
            print("mk3-settings-watcher: HID read error, reconnecting...",
                  file=sys.stderr)
        finally:
            os.close(fd)

        time.sleep(2)


if __name__ == "__main__":
    main()
