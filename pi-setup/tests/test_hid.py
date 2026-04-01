"""Tests for HID report parsing."""
import unittest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mk3_overlay.hid import parse_buttons, parse_knob, parse_stepper, BUTTONS


class TestParseButtons(unittest.TestCase):
    def _make_report(self, overrides=None):
        data = bytearray(12)
        data[0] = 0x01
        if overrides:
            for idx, val in overrides.items():
                data[idx] = val
        return bytes(data)

    def test_no_buttons_pressed(self):
        report = self._make_report()
        prev = self._make_report()
        pressed, released = parse_buttons(report, prev)
        self.assertEqual(pressed, set())
        self.assertEqual(released, set())

    def test_single_button_press(self):
        prev = self._make_report()
        curr = self._make_report({0x07: 0x02})
        pressed, released = parse_buttons(curr, prev)
        self.assertIn("settings", pressed)
        self.assertEqual(released, set())

    def test_single_button_release(self):
        prev = self._make_report({0x07: 0x02})
        curr = self._make_report()
        pressed, released = parse_buttons(curr, prev)
        self.assertEqual(pressed, set())
        self.assertIn("settings", released)

    def test_held_button_no_edge(self):
        both = self._make_report({0x07: 0x02})
        pressed, released = parse_buttons(both, both)
        self.assertEqual(pressed, set())
        self.assertEqual(released, set())

    def test_multiple_buttons(self):
        prev = self._make_report()
        curr = self._make_report({0x01: 0x05})
        pressed, released = parse_buttons(curr, prev)
        self.assertIn("navPush", pressed)
        self.assertIn("navUp", pressed)


class TestParseKnob(unittest.TestCase):
    def test_knob_clockwise(self):
        prev_report = bytearray(28); prev_report[0] = 0x01
        curr_report = bytearray(28); curr_report[0] = 0x01; curr_report[12] = 0x05
        delta = parse_knob(bytes(curr_report), bytes(prev_report), "k1")
        self.assertEqual(delta, 5)

    def test_knob_counter_clockwise(self):
        prev_report = bytearray(28); prev_report[0] = 0x01; prev_report[12] = 0x05
        curr_report = bytearray(28); curr_report[0] = 0x01
        delta = parse_knob(bytes(curr_report), bytes(prev_report), "k1")
        self.assertEqual(delta, -5)

    def test_knob_no_change(self):
        report = bytearray(28); report[0] = 0x01
        delta = parse_knob(bytes(report), bytes(report), "k1")
        self.assertEqual(delta, 0)


class TestParseStepper(unittest.TestCase):
    def test_stepper_clockwise(self):
        prev = bytearray(12); prev[0] = 0x01; prev[11] = 0x03
        curr = bytearray(12); curr[0] = 0x01; curr[11] = 0x05
        self.assertEqual(parse_stepper(bytes(curr), bytes(prev)), 1)

    def test_stepper_counter_clockwise(self):
        prev = bytearray(12); prev[0] = 0x01; prev[11] = 0x05
        curr = bytearray(12); curr[0] = 0x01; curr[11] = 0x03
        self.assertEqual(parse_stepper(bytes(curr), bytes(prev)), -1)

    def test_stepper_no_change(self):
        report = bytearray(12); report[0] = 0x01; report[11] = 0x05
        self.assertEqual(parse_stepper(bytes(report), bytes(report)), 0)

    def test_stepper_wraparound_forward(self):
        prev = bytearray(12); prev[0] = 0x01; prev[11] = 0x0F
        curr = bytearray(12); curr[0] = 0x01; curr[11] = 0x00
        self.assertEqual(parse_stepper(bytes(curr), bytes(prev)), 1)

    def test_stepper_wraparound_backward(self):
        prev = bytearray(12); prev[0] = 0x01; prev[11] = 0x00
        curr = bytearray(12); curr[0] = 0x01; curr[11] = 0x0F
        self.assertEqual(parse_stepper(bytes(curr), bytes(prev)), -1)

if __name__ == "__main__":
    unittest.main()
