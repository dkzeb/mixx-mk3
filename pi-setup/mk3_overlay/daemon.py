#!/usr/bin/env python3
"""MK3 Overlay Widget System daemon.

Reads HID input from the MK3, manages widget lifecycle, renders Qt overlay
windows on Xvfb :99, and coordinates with Mixxx/T9/mouse via focus trapping.
"""
import os
import sys
import signal
import argparse

from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import QTimer

from .hid import find_hidraw, open_hidraw, read_report, parse_buttons, parse_stepper, parse_knob, LedWriter, KNOBS
from .widget import ActionItem, ToggleItem
from .renderer import OverlayWindow
from . import focus
from .widgets.settings import create_settings_widget

LOG_PREFIX = "mk3-overlay"
POLL_INTERVAL_MS = 16  # ~60Hz
RECONNECT_DELAY_MS = 3000
CONFIRM_TIMEOUT_MS = 5000


def log(msg):
    print(f"{LOG_PREFIX}: {msg}", file=sys.stderr, flush=True)


class OverlayDaemon:
    """Main daemon: HID poll loop, widget manager, Qt window lifecycle."""

    def __init__(self, device_path=None):
        self._device_path = device_path
        self._fd = None
        self._prev_report = bytes(64)
        self._leds = None
        self._active_widget = None
        self._widgets = {}
        self._window = OverlayWindow()
        self._confirm_timer = None

        self._poll_timer = QTimer()
        self._poll_timer.timeout.connect(self._poll)

        self._reconnect_timer = QTimer()
        self._reconnect_timer.setSingleShot(True)
        self._reconnect_timer.timeout.connect(self._try_connect)

    def register_widget(self, widget):
        """Register a widget by its activation button."""
        self._widgets[widget.activate_button] = widget

    def start(self):
        """Start the daemon: attempt HID connection and begin polling."""
        self._try_connect()

    def _try_connect(self):
        path = find_hidraw(self._device_path)
        if path is None:
            log("waiting for MK3 HID device...")
            self._reconnect_timer.start(RECONNECT_DELAY_MS)
            return

        try:
            self._fd = open_hidraw(path)
        except OSError as e:
            log(f"cannot open {path}: {e}")
            self._reconnect_timer.start(RECONNECT_DELAY_MS)
            return

        log(f"listening on {path}")
        self._prev_report = bytes(64)
        self._leds = LedWriter(self._fd)
        self._poll_timer.start(POLL_INTERVAL_MS)

    def _disconnect(self):
        self._poll_timer.stop()
        if self._active_widget:
            self._deactivate_widget()
        if self._fd is not None:
            try:
                os.close(self._fd)
            except OSError:
                pass
            self._fd = None
        self._leds = None
        log("HID read error, reconnecting...")
        self._reconnect_timer.start(RECONNECT_DELAY_MS)

    def _poll(self):
        report = read_report(self._fd)
        if report is None:
            return
        if len(report) == 0:
            self._disconnect()
            return

        report_id = report[0]
        if report_id != 0x01:
            return

        pressed, released = parse_buttons(report, self._prev_report)

        # Check activation buttons (always, even when a widget is active)
        for btn_name, widget in self._widgets.items():
            if btn_name in pressed:
                if self._active_widget is widget:
                    self._deactivate_widget()
                    self._prev_report = report
                    return
                elif self._active_widget is None:
                    self._activate_widget(widget)
                    self._prev_report = report
                    return

        # Route input to active widget
        if self._active_widget:
            self._handle_widget_input(pressed, released, report)

        self._prev_report = report

    def _activate_widget(self, widget):
        self._active_widget = widget
        widget.on_activate()
        focus.activate()
        self._window.set_widget(widget)
        self._window.show()
        self._window.update()
        self._update_leds()
        log(f"widget '{widget.name}' activated")

    def _deactivate_widget(self):
        name = self._active_widget.name
        self._active_widget.on_deactivate()
        self._active_widget = None
        self._cancel_confirm_timer()
        focus.deactivate()
        self._window.hide()
        if self._leds:
            self._leds.all_off()
            self._leds.send()
        log(f"widget '{name}' deactivated")

    def _handle_widget_input(self, pressed, released, report):
        w = self._active_widget
        repaint = False

        if "navUp" in pressed:
            w.move_cursor(-1)
            self._cancel_confirm_timer()
            repaint = True
        if "navDown" in pressed:
            w.move_cursor(1)
            self._cancel_confirm_timer()
            repaint = True

        stepper_delta = parse_stepper(report, self._prev_report)
        if stepper_delta != 0:
            w.move_cursor(-1 if stepper_delta < 0 else 1)
            self._cancel_confirm_timer()
            repaint = True

        if "arrowLeft" in pressed:
            w.switch_page(-1)
            self._cancel_confirm_timer()
            repaint = True
        if "arrowRight" in pressed:
            w.switch_page(1)
            self._cancel_confirm_timer()
            repaint = True

        for i in range(1, 9):
            d_name = f"d{i}"
            if d_name in pressed:
                page_idx = i - 1
                if page_idx < len(w.pages):
                    w.jump_to_page(page_idx)
                    self._cancel_confirm_timer()
                    repaint = True
                break

        if "navPush" in pressed:
            was_confirming = w.confirming
            w.execute_item()
            if w.confirming and not was_confirming:
                self._start_confirm_timer()
            elif not w.confirming:
                self._cancel_confirm_timer()
            repaint = True

        for knob_name in KNOBS:
            delta = parse_knob(report, self._prev_report, knob_name)
            if delta != 0:
                bindings = w.page.knob_bindings
                if knob_name in bindings:
                    bindings[knob_name](delta)
                    repaint = True

        if repaint:
            self._window.update()
            self._update_leds()

    def _update_leds(self):
        if not self._leds or not self._active_widget:
            return
        w = self._active_widget
        self._leds.all_off()
        self._leds.set_led(w.activate_button, 63)
        for i, page in enumerate(w.pages):
            d_name = f"d{i + 1}"
            brightness = 63 if i == w.current_page else 16
            self._leds.set_led(d_name, brightness)
        self._leds.send()

    def _start_confirm_timer(self):
        self._cancel_confirm_timer()
        self._confirm_timer = QTimer()
        self._confirm_timer.setSingleShot(True)
        self._confirm_timer.timeout.connect(self._on_confirm_timeout)
        self._confirm_timer.start(CONFIRM_TIMEOUT_MS)

    def _cancel_confirm_timer(self):
        if self._confirm_timer:
            self._confirm_timer.stop()
            self._confirm_timer = None

    def _on_confirm_timeout(self):
        if self._active_widget:
            self._active_widget.cancel_confirm()
            self._window.update()
        self._confirm_timer = None


def main():
    parser = argparse.ArgumentParser(description="MK3 Overlay Widget System")
    parser.add_argument("--device", help="HID device path (default: auto-detect)")
    args = parser.parse_args()

    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))

    app = QApplication(sys.argv)
    app.setApplicationName("mk3-overlay")

    daemon = OverlayDaemon(device_path=args.device)
    settings = create_settings_widget()
    daemon.register_widget(settings)

    daemon.start()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
