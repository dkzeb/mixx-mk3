"""Tests for Widget/Page/Item navigation logic."""
import unittest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mk3_overlay.widget import Widget, Page, ActionItem, ToggleItem, InfoItem


class TestCursorNavigation(unittest.TestCase):
    def _make_widget(self):
        page = Page(title="TEST", items=[
            ActionItem(label="Action 1"),
            InfoItem(label="Info (skip)"),
            ActionItem(label="Action 2"),
            ToggleItem(label="Toggle 1", state=False),
        ])
        return Widget(name="test", position=(0, 0, 480, 272),
                      activate_button="settings", pages=[page])

    def test_initial_cursor_on_first_selectable(self):
        self.assertEqual(self._make_widget().cursor, 0)

    def test_move_down_skips_info(self):
        w = self._make_widget()
        w.move_cursor(1)
        self.assertEqual(w.cursor, 2)

    def test_move_up_skips_info(self):
        w = self._make_widget()
        w.cursor = 2
        w.move_cursor(-1)
        self.assertEqual(w.cursor, 0)

    def test_wrap_down(self):
        w = self._make_widget()
        w.cursor = 3
        w.move_cursor(1)
        self.assertEqual(w.cursor, 0)

    def test_wrap_up(self):
        w = self._make_widget()
        w.cursor = 0
        w.move_cursor(-1)
        self.assertEqual(w.cursor, 3)


class TestPageSwitching(unittest.TestCase):
    def _make_widget(self):
        pages = [
            Page(title="P1", items=[ActionItem(label="A")]),
            Page(title="P2", items=[ActionItem(label="B"), InfoItem(label="I"), ActionItem(label="C")]),
            Page(title="P3", items=[InfoItem(label="I"), ToggleItem(label="T", state=True)]),
        ]
        return Widget(name="test", position=(0, 0, 480, 272),
                      activate_button="settings", pages=pages)

    def test_initial_page(self):
        self.assertEqual(self._make_widget().current_page, 0)

    def test_next_page(self):
        w = self._make_widget()
        w.switch_page(1)
        self.assertEqual(w.current_page, 1)

    def test_prev_page_wraps(self):
        w = self._make_widget()
        w.switch_page(-1)
        self.assertEqual(w.current_page, 2)

    def test_next_page_wraps(self):
        w = self._make_widget()
        w.current_page = 2
        w.switch_page(1)
        self.assertEqual(w.current_page, 0)

    def test_cursor_resets_to_first_selectable_on_page_switch(self):
        w = self._make_widget()
        w.cursor = 0
        w.switch_page(1)
        self.assertEqual(w.cursor, 0)
        w.switch_page(1)  # page 3: info at 0, toggle at 1
        self.assertEqual(w.cursor, 1)

    def test_jump_to_page(self):
        w = self._make_widget()
        w.jump_to_page(2)
        self.assertEqual(w.current_page, 2)

    def test_jump_to_page_out_of_range_ignored(self):
        w = self._make_widget()
        w.jump_to_page(5)
        self.assertEqual(w.current_page, 0)


class TestConfirmation(unittest.TestCase):
    def test_confirm_action_first_push_enters_confirm(self):
        executed = []
        page = Page(title="T", items=[
            ActionItem(label="Dangerous", confirm=True, on_execute=lambda: executed.append(True)),
        ])
        w = Widget(name="t", position=(0, 0, 480, 272), activate_button="x", pages=[page])
        w.execute_item()
        self.assertTrue(w.confirming)
        self.assertEqual(executed, [])

    def test_confirm_action_second_push_executes(self):
        executed = []
        page = Page(title="T", items=[
            ActionItem(label="Dangerous", confirm=True, on_execute=lambda: executed.append(True)),
        ])
        w = Widget(name="t", position=(0, 0, 480, 272), activate_button="x", pages=[page])
        w.execute_item()
        w.execute_item()
        self.assertFalse(w.confirming)
        self.assertEqual(executed, [True])

    def test_cursor_move_cancels_confirm(self):
        page = Page(title="T", items=[
            ActionItem(label="A", confirm=True, on_execute=lambda: None),
            ActionItem(label="B"),
        ])
        w = Widget(name="t", position=(0, 0, 480, 272), activate_button="x", pages=[page])
        w.execute_item()
        self.assertTrue(w.confirming)
        w.move_cursor(1)
        self.assertFalse(w.confirming)

    def test_non_confirm_action_executes_immediately(self):
        executed = []
        page = Page(title="T", items=[
            ActionItem(label="Safe", on_execute=lambda: executed.append(True)),
        ])
        w = Widget(name="t", position=(0, 0, 480, 272), activate_button="x", pages=[page])
        w.execute_item()
        self.assertEqual(executed, [True])


class TestToggle(unittest.TestCase):
    def test_toggle_flips_state(self):
        toggled = []
        page = Page(title="T", items=[
            ToggleItem(label="Opt", state=False, on_toggle=lambda s: toggled.append(s)),
        ])
        w = Widget(name="t", position=(0, 0, 480, 272), activate_button="x", pages=[page])
        w.execute_item()
        self.assertTrue(w.pages[0].items[0].state)
        self.assertEqual(toggled, [True])

    def test_toggle_flips_back(self):
        toggled = []
        page = Page(title="T", items=[
            ToggleItem(label="Opt", state=True, on_toggle=lambda s: toggled.append(s)),
        ])
        w = Widget(name="t", position=(0, 0, 480, 272), activate_button="x", pages=[page])
        w.execute_item()
        self.assertFalse(w.pages[0].items[0].state)
        self.assertEqual(toggled, [False])


class TestInfoItem(unittest.TestCase):
    def test_info_value_fn(self):
        item = InfoItem(label="IP", value_fn=lambda: "192.168.1.5")
        self.assertEqual(item.get_value(), "192.168.1.5")

    def test_info_no_value_fn(self):
        item = InfoItem(label="Version")
        self.assertEqual(item.get_value(), "")

if __name__ == "__main__":
    unittest.main()
