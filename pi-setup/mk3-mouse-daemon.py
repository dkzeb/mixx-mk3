#!/usr/bin/env python3
"""Mouse mode daemon for NI Maschine MK3.

Reads nav encoder inputs from hidraw, moves the system cursor via xdotool,
and controls Auto/Macro button LEDs. Runs as a systemd service.

Toggle mouse mode by pressing Auto + Macro simultaneously.
"""
import glob
import os
import subprocess
import sys
import time

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VENDOR_ID = "17CC"
PRODUCT_ID = "1600"

LOG_PREFIX = "mk3-mouse"

# Auto button: Report 0x01, byte 0x08, mask 0x20
AUTO_BYTE = 0x08
AUTO_MASK = 0x20

# Macro button: Report 0x01, byte 0x07, mask 0x01
MACRO_BYTE = 0x07
MACRO_MASK = 0x01

# Shift button: Report 0x01, byte 0x01, mask 0x40
SHIFT_BYTE = 0x01
SHIFT_MASK = 0x40

# Nav buttons: all in Report 0x01, byte 0x01
NAV_PUSH_MASK = 0x01
NAV_UP_MASK = 0x04
NAV_RIGHT_MASK = 0x08
NAV_DOWN_MASK = 0x10
NAV_LEFT_MASK = 0x20
NAV_BYTE = 0x01

# Stepper: Report 0x01, byte 11 (0x0B), lower 4 bits
STEPPER_BYTE = 0x0B

# T9 toggle (browserPlugin): byte 0x08, mask 0x04 — watch for deactivation
T9_TOGGLE_BYTE = 0x08
T9_TOGGLE_MASK = 0x04

# LED Report 0x80: 63 bytes (byte 0 = 0x80, bytes 1-62 = data)
LED_REPORT_ID = 0x80
LED_REPORT_SIZE = 63

# Auto LED: data byte 11, Macro LED: data byte 12
AUTO_LED_OFFSET = 11
MACRO_LED_OFFSET = 12
LED_FULL = 63
LED_OFF = 0

# Speed
SPEED_DEFAULT = 8
SPEED_MIN = 1
SPEED_MAX = 30


# ---------------------------------------------------------------------------
# ButtonLedWriter — writes Report 0x80 for button LEDs
# ---------------------------------------------------------------------------
class ButtonLedWriter:
    """Builds and sends LED Report 0x80 over hidraw."""

    def __init__(self, fd):
        self._fd = fd
        self._buf = bytearray(LED_REPORT_SIZE)
        self._buf[0] = LED_REPORT_ID

    def set_mouse_leds(self, on):
        """Set Auto + Macro LEDs to full brightness or off."""
        val = LED_FULL if on else LED_OFF
        self._buf[AUTO_LED_OFFSET] = val
        self._buf[MACRO_LED_OFFSET] = val

    def send(self):
        """Write the LED report to the hidraw device."""
        try:
            os.write(self._fd, bytes(self._buf))
        except OSError as e:
            print(f"{LOG_PREFIX}: LED write error: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# MouseController — xdotool wrapper
# ---------------------------------------------------------------------------
class MouseController:
    """Moves the system cursor and clicks via xdotool."""

    def __init__(self, display=":99"):
        self._env = {**os.environ, "DISPLAY": display}

    def move(self, dx, dy):
        """Move cursor relative to current position."""
        subprocess.run(
            ["xdotool", "mousemove_relative", "--", str(dx), str(dy)],
            env=self._env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def click(self, button=1):
        """Click a mouse button (1=left, 3=right)."""
        subprocess.run(
            ["xdotool", "click", str(button)],
            env=self._env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


# ---------------------------------------------------------------------------
# HID device discovery (same as T9 daemon)
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
# Main daemon loop
# ---------------------------------------------------------------------------
def main():
    display = os.environ.get("DISPLAY", ":99")
    mouse = MouseController(display)

    while True:
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

        leds = ButtonLedWriter(fd)
        mouse_active = False
        speed = SPEED_DEFAULT

        auto_was_pressed = False
        macro_was_pressed = False
        nav_push_was = False
        stepper_position = None
        t9_was_pressed = False

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

                if report_id != 0x01 or len(data) <= STEPPER_BYTE:
                    continue

                # --- Toggle detection: Auto + Macro ---
                auto_pressed = (data[AUTO_BYTE] & AUTO_MASK) != 0
                macro_pressed = (data[MACRO_BYTE] & MACRO_MASK) != 0

                auto_edge = auto_pressed and not auto_was_pressed
                macro_edge = macro_pressed and not macro_was_pressed

                # Toggle when second button press edge fires while first is held
                if (auto_edge and macro_pressed) or (macro_edge and auto_pressed):
                    mouse_active = not mouse_active
                    speed = SPEED_DEFAULT
                    stepper_position = None
                    nav_push_was = False
                    leds.set_mouse_leds(mouse_active)
                    leds.send()
                    state = "ON" if mouse_active else "OFF"
                    print(f"{LOG_PREFIX}: mouse mode {state}", file=sys.stderr)

                auto_was_pressed = auto_pressed
                macro_was_pressed = macro_pressed

                # --- T9 toggle: deactivate mouse if T9 activates ---
                t9_pressed = (data[T9_TOGGLE_BYTE] & T9_TOGGLE_MASK) != 0
                if t9_pressed and not t9_was_pressed and mouse_active:
                    print(f"{LOG_PREFIX}: T9 toggled, deactivating mouse", file=sys.stderr)
                    mouse_active = False
                    speed = SPEED_DEFAULT
                    stepper_position = None
                    nav_push_was = False
                    leds.set_mouse_leds(False)
                    leds.send()
                t9_was_pressed = t9_pressed

                if not mouse_active:
                    continue

                # --- Nav directional movement (continuous while held) ---
                nav = data[NAV_BYTE]
                dx, dy = 0, 0
                if nav & NAV_UP_MASK:
                    dy -= speed
                if nav & NAV_DOWN_MASK:
                    dy += speed
                if nav & NAV_LEFT_MASK:
                    dx -= speed
                if nav & NAV_RIGHT_MASK:
                    dx += speed

                if dx != 0 or dy != 0:
                    mouse.move(dx, dy)

                # --- Nav push: click (edge-triggered) ---
                shift_held = (data[SHIFT_BYTE] & SHIFT_MASK) != 0
                nav_push = (nav & NAV_PUSH_MASK) != 0

                if nav_push and not nav_push_was:
                    if shift_held:
                        mouse.click(3)  # right click
                    else:
                        mouse.click(1)  # left click

                nav_push_was = nav_push

                # --- Stepper: speed adjustment ---
                new_stepper = data[STEPPER_BYTE] & 0x0F
                if stepper_position is None:
                    stepper_position = new_stepper
                elif new_stepper != stepper_position:
                    jump_back = (stepper_position == 0x00 and new_stepper == 0x0F)
                    jump_fwd = (stepper_position == 0x0F and new_stepper == 0x00)
                    if (stepper_position < new_stepper and not jump_back) or jump_fwd:
                        speed = min(speed + 1, SPEED_MAX)
                    else:
                        speed = max(speed - 1, SPEED_MIN)
                    stepper_position = new_stepper
                    print(f"{LOG_PREFIX}: speed={speed}", file=sys.stderr)

        except OSError:
            print(f"{LOG_PREFIX}: HID read error, reconnecting...", file=sys.stderr)
        finally:
            try:
                leds.set_mouse_leds(False)
                leds.send()
            except OSError:
                pass
            os.close(fd)

        time.sleep(2)


if __name__ == "__main__":
    main()
