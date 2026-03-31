"""Comprehensive tests for T9Engine multi-tap state machine."""

import importlib
import sys
import unittest
from unittest.mock import MagicMock, patch

# The module file has a hyphen in its name, so we import it manually.
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "mk3_t9_engine",
    __file__.replace("test_t9_engine.py", "mk3-t9-engine.py"),
)
mk3_t9_engine = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mk3_t9_engine)

T9Engine = mk3_t9_engine.T9Engine
CHAR_MAP = mk3_t9_engine.CHAR_MAP
PAD_ENTER = mk3_t9_engine.PAD_ENTER
PAD_CANCEL = mk3_t9_engine.PAD_CANCEL
PAD_BACKSPACE = mk3_t9_engine.PAD_BACKSPACE
COMMIT_TIMEOUT = mk3_t9_engine.COMMIT_TIMEOUT


class TestCharacterCycling(unittest.TestCase):
    """Test basic character cycling behavior."""

    def setUp(self):
        self.engine = T9Engine()

    def test_first_press_gives_first_char(self):
        result = self.engine.press(14)  # a,b,c,2
        self.assertEqual(result, "a")

    def test_repeated_press_cycles(self):
        self.engine.press(14)
        result = self.engine.press(14)
        self.assertEqual(result, "b")

    def test_cycle_wraps_around(self):
        # Pad 14 has 4 chars: a, b, c, 2
        self.engine.press(14)
        self.engine.press(14)
        self.engine.press(14)
        self.engine.press(14)
        result = self.engine.press(14)  # wraps back to "a"
        self.assertEqual(result, "a")

    def test_four_letter_key(self):
        # Pad 5 has: p, q, r, s, 7
        self.engine.press(5)
        self.engine.press(5)
        self.engine.press(5)
        result = self.engine.press(5)
        self.assertEqual(result, "s")

    def test_space_pad(self):
        result = self.engine.press(13)
        self.assertEqual(result, " ")

    def test_number_pad(self):
        result = self.engine.press(2)  # 0, +
        self.assertEqual(result, "0")
        result = self.engine.press(2)
        self.assertEqual(result, "+")

    def test_hash_pad(self):
        result = self.engine.press(1)
        self.assertEqual(result, "#")

    def test_star_pad(self):
        result = self.engine.press(3)
        self.assertEqual(result, "*")

    def test_pending_pad_tracks_current(self):
        self.engine.press(14)
        self.assertEqual(self.engine.get_pending_pad(), 14)

    def test_no_pending_after_commit(self):
        """Single-char pads auto-commit since there is nothing to cycle."""
        # Pad 1 has only "#" -- still pending since user might be cycling
        self.engine.press(1)
        self.assertEqual(self.engine.get_pending_pad(), 1)


class TestCommitRules(unittest.TestCase):
    """Test when pending characters get committed."""

    def setUp(self):
        self.engine = T9Engine()

    def test_different_pad_commits_previous(self):
        self.engine.press(14)  # "a" pending
        result = self.engine.press(15)  # commits "a", "d" pending
        self.assertEqual(result, "ad")

    def test_timeout_commits_via_tick(self):
        with patch.object(mk3_t9_engine, "time") as mock_time:
            mock_time.monotonic.return_value = 100.0
            self.engine.press(14)  # "a" pending

            mock_time.monotonic.return_value = 100.0 + COMMIT_TIMEOUT + 0.01
            committed = self.engine.tick()

            self.assertTrue(committed)
            self.assertEqual(self.engine.get_text(), "a")
            self.assertIsNone(self.engine.get_pending_pad())

    def test_tick_no_commit_before_timeout(self):
        with patch.object(mk3_t9_engine, "time") as mock_time:
            mock_time.monotonic.return_value = 100.0
            self.engine.press(14)

            mock_time.monotonic.return_value = 100.0 + COMMIT_TIMEOUT - 0.01
            committed = self.engine.tick()

            self.assertFalse(committed)
            self.assertIsNotNone(self.engine.get_pending_pad())

    def test_tick_no_pending_returns_false(self):
        result = self.engine.tick()
        self.assertFalse(result)

    def test_same_pad_after_timeout_starts_new_cycle(self):
        with patch.object(mk3_t9_engine, "time") as mock_time:
            mock_time.monotonic.return_value = 100.0
            self.engine.press(14)  # "a" pending

            # Press same pad after timeout
            mock_time.monotonic.return_value = 100.0 + COMMIT_TIMEOUT + 0.1
            result = self.engine.press(14)

            # "a" committed, new "a" pending
            self.assertEqual(result, "aa")


class TestBackspace(unittest.TestCase):
    """Test backspace behavior."""

    def setUp(self):
        self.engine = T9Engine()

    def test_backspace_cancels_pending(self):
        self.engine.press(14)  # "a" pending
        result = self.engine.press(PAD_BACKSPACE)
        self.assertEqual(result, "")
        self.assertIsNone(self.engine.get_pending_pad())

    def test_backspace_deletes_committed(self):
        # Type "ab" committed
        with patch.object(mk3_t9_engine, "time") as mock_time:
            mock_time.monotonic.return_value = 100.0
            self.engine.press(14)  # "a" pending

            mock_time.monotonic.return_value = 101.0
            self.engine.press(14)  # timeout -> commit "a", new "a" pending

            mock_time.monotonic.return_value = 101.5
            self.engine.press(14)  # cycle to "b" pending

            # Different pad to commit "b"
            mock_time.monotonic.return_value = 102.0
            self.engine.press(15)  # commits "b", "d" pending

            # Backspace cancels "d" pending
            self.engine.press(PAD_BACKSPACE)
            self.assertEqual(self.engine.get_text(), "ab")

            # Backspace deletes "b" committed
            self.engine.press(PAD_BACKSPACE)
            self.assertEqual(self.engine.get_text(), "a")

    def test_backspace_on_empty_is_noop(self):
        result = self.engine.press(PAD_BACKSPACE)
        self.assertEqual(result, "")

    def test_backspace_prefers_pending_over_committed(self):
        """If there is a pending char, backspace removes it, not committed."""
        self.engine.press(14)  # "a" pending
        self.engine.press(15)  # commit "a", "d" pending
        self.engine.press(PAD_BACKSPACE)  # cancel "d" pending
        self.assertEqual(self.engine.get_text(), "a")


class TestEnter(unittest.TestCase):
    """Test enter/submit behavior."""

    def setUp(self):
        self.on_submit = MagicMock()
        self.engine = T9Engine(on_submit=self.on_submit)

    def test_enter_commits_pending_and_submits(self):
        self.engine.press(14)  # "a" pending
        result = self.engine.press(PAD_ENTER)
        self.assertEqual(result, "a")
        self.on_submit.assert_called_once_with("a")
        self.assertIsNone(self.engine.get_pending_pad())

    def test_enter_submits_committed_text(self):
        self.engine.press(14)  # "a"
        self.engine.press(15)  # commit "a", "d" pending
        result = self.engine.press(PAD_ENTER)  # commit "d", submit "ad"
        self.assertEqual(result, "ad")
        self.on_submit.assert_called_once_with("ad")

    def test_enter_on_empty_submits_empty(self):
        result = self.engine.press(PAD_ENTER)
        self.assertEqual(result, "")
        self.on_submit.assert_called_once_with("")


class TestCancel(unittest.TestCase):
    """Test cancel behavior."""

    def setUp(self):
        self.on_cancel = MagicMock()
        self.on_submit = MagicMock()
        self.engine = T9Engine(on_submit=self.on_submit, on_cancel=self.on_cancel)

    def test_cancel_discards_all(self):
        self.engine.press(14)
        self.engine.press(15)
        result = self.engine.press(PAD_CANCEL)
        self.assertEqual(result, "")
        self.assertIsNone(self.engine.get_pending_pad())

    def test_cancel_fires_on_cancel(self):
        self.engine.press(14)
        self.engine.press(PAD_CANCEL)
        self.on_cancel.assert_called_once()

    def test_cancel_does_not_fire_on_submit(self):
        self.engine.press(14)
        self.engine.press(PAD_CANCEL)
        self.on_submit.assert_not_called()


class TestCallbacks(unittest.TestCase):
    """Test callback firing behavior."""

    def test_on_change_fires_on_press(self):
        on_change = MagicMock()
        engine = T9Engine(on_change=on_change)
        engine.press(14)
        on_change.assert_called_once_with("a")

    def test_on_change_fires_on_backspace(self):
        on_change = MagicMock()
        engine = T9Engine(on_change=on_change)
        engine.press(14)
        on_change.reset_mock()
        engine.press(PAD_BACKSPACE)
        on_change.assert_called_once_with("")

    def test_on_change_fires_on_tick_commit(self):
        on_change = MagicMock()
        engine = T9Engine(on_change=on_change)

        with patch.object(mk3_t9_engine, "time") as mock_time:
            mock_time.monotonic.return_value = 100.0
            engine.press(14)
            on_change.reset_mock()

            mock_time.monotonic.return_value = 100.0 + COMMIT_TIMEOUT + 0.01
            engine.tick()
            on_change.assert_called_once_with("a")

    def test_on_change_fires_when_different_pad_commits(self):
        on_change = MagicMock()
        engine = T9Engine(on_change=on_change)
        engine.press(14)
        on_change.reset_mock()
        engine.press(15)
        on_change.assert_called_once_with("ad")

    def test_on_change_fires_on_cancel(self):
        on_change = MagicMock()
        engine = T9Engine(on_change=on_change)
        engine.press(14)
        on_change.reset_mock()
        engine.press(PAD_CANCEL)
        on_change.assert_called_once_with("")


class TestMultiWordInput(unittest.TestCase):
    """End-to-end test typing a word."""

    def test_type_hello(self):
        """Type 'hello' using the T9 engine."""
        engine = T9Engine()

        with patch.object(mk3_t9_engine, "time") as mock_time:
            t = 100.0
            mock_time.monotonic.return_value = t

            # h = pad 9, second char (g, h, i, 4)
            engine.press(9)    # g
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(9)    # h
            self.assertEqual(engine.get_text(), "h")

            # Wait for timeout to commit "h"
            t += COMMIT_TIMEOUT + 0.1
            mock_time.monotonic.return_value = t
            engine.tick()
            self.assertEqual(engine.get_text(), "h")
            self.assertIsNone(engine.get_pending_pad())

            # e = pad 15, second char (d, e, f, 3)
            engine.press(15)   # d
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(15)   # e
            self.assertEqual(engine.get_text(), "he")

            # l = pad 10, third char (j, k, l, 5)
            # Pressing different pad commits "e"
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(10)   # j
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(10)   # k
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(10)   # l
            self.assertEqual(engine.get_text(), "hel")

            # Second l = same pad after timeout
            t += COMMIT_TIMEOUT + 0.1
            mock_time.monotonic.return_value = t
            engine.press(10)   # commits "l", new "j"
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(10)   # k
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(10)   # l
            self.assertEqual(engine.get_text(), "hell")

            # o = pad 11, third char (m, n, o, 6)
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(11)   # commits "l", "m"
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(11)   # n
            t += 0.3
            mock_time.monotonic.return_value = t
            engine.press(11)   # o
            self.assertEqual(engine.get_text(), "hello")


class TestReset(unittest.TestCase):
    """Test reset clears everything."""

    def test_reset_clears_all_state(self):
        engine = T9Engine()
        engine.press(14)
        engine.press(15)
        engine.reset()
        self.assertEqual(engine.get_text(), "")
        self.assertIsNone(engine.get_pending_pad())


class TestUnknownPads(unittest.TestCase):
    """Test that unknown/unassigned pads are ignored."""

    def test_unknown_pad_ignored(self):
        engine = T9Engine()
        result = engine.press(8)
        self.assertEqual(result, "")

    def test_unknown_pad_does_not_affect_pending(self):
        engine = T9Engine()
        engine.press(14)  # "a" pending
        engine.press(8)   # should be ignored
        self.assertEqual(engine.get_text(), "a")
        self.assertEqual(engine.get_pending_pad(), 14)

    def test_unknown_pad_does_not_commit_pending(self):
        engine = T9Engine()
        engine.press(14)  # "a" pending
        engine.press(8)   # should NOT commit "a"
        # Still pending on pad 14
        self.assertEqual(engine.get_pending_pad(), 14)


if __name__ == "__main__":
    unittest.main()
