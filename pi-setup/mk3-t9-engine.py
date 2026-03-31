"""T9 multi-tap text input engine for NI Maschine MK3 pads.

Pure logic layer -- no HID, no xdotool, no LED control.
Takes pad indices (1-16), produces text via callbacks.
"""

import time

# Character map: pad index -> list of characters to cycle through
CHAR_MAP = {
    13: [" "],
    14: ["a", "b", "c", "2"],
    15: ["d", "e", "f", "3"],
    9:  ["g", "h", "i", "4"],
    10: ["j", "k", "l", "5"],
    11: ["m", "n", "o", "6"],
    5:  ["p", "q", "r", "s", "7"],
    6:  ["t", "u", "v", "8"],
    7:  ["w", "x", "y", "z", "9"],
    2:  ["0", "+"],
    1:  ["#"],
    3:  ["*"],
}

# Special pad constants
PAD_ENTER = 4
PAD_CANCEL = 12
PAD_BACKSPACE = 16

# Timeout in seconds before a pending character is auto-committed
COMMIT_TIMEOUT = 0.8


class T9Engine:
    """Multi-tap T9 state machine.

    Call press(pad) for each pad hit, tick() from a main loop to
    handle timeouts. Register callbacks to be notified of state changes.
    """

    def __init__(self, on_change=None, on_submit=None, on_cancel=None):
        self.on_change = on_change
        self.on_submit = on_submit
        self.on_cancel = on_cancel

        self._committed = []       # List of committed characters
        self._pending_pad = None   # Pad currently being cycled, or None
        self._pending_index = 0    # Index into CHAR_MAP[_pending_pad]
        self._last_press_time = 0  # time.monotonic() of last press

    def press(self, pad):
        """Handle a pad press. Returns current display text."""
        if pad == PAD_ENTER:
            self._commit_pending()
            text = self.get_text()
            if self.on_change:
                self.on_change(text)
            if self.on_submit:
                self.on_submit(text)
            return text

        if pad == PAD_CANCEL:
            self._committed.clear()
            self._pending_pad = None
            self._pending_index = 0
            if self.on_cancel:
                self.on_cancel()
            if self.on_change:
                self.on_change(self.get_text())
            return self.get_text()

        if pad == PAD_BACKSPACE:
            if self._pending_pad is not None:
                # Cancel pending cycle
                self._pending_pad = None
                self._pending_index = 0
            elif self._committed:
                self._committed.pop()
            if self.on_change:
                self.on_change(self.get_text())
            return self.get_text()

        # Character pads
        if pad not in CHAR_MAP:
            return self.get_text()

        now = time.monotonic()

        if self._pending_pad == pad:
            # Same pad pressed again -- check if within timeout
            elapsed = now - self._last_press_time
            if elapsed < COMMIT_TIMEOUT:
                # Cycle to next character (wrap around)
                chars = CHAR_MAP[pad]
                self._pending_index = (self._pending_index + 1) % len(chars)
                self._last_press_time = now
            else:
                # Timeout elapsed, commit pending and start fresh cycle
                self._commit_pending()
                self._pending_pad = pad
                self._pending_index = 0
                self._last_press_time = now
        else:
            # Different pad -- commit any pending, start new cycle
            self._commit_pending()
            self._pending_pad = pad
            self._pending_index = 0
            self._last_press_time = now

        if self.on_change:
            self.on_change(self.get_text())
        return self.get_text()

    def tick(self):
        """Call from main loop. Commits pending char if timeout elapsed.

        Returns True if a commit happened, False otherwise.
        """
        if self._pending_pad is None:
            return False

        now = time.monotonic()
        if now - self._last_press_time >= COMMIT_TIMEOUT:
            self._commit_pending()
            if self.on_change:
                self.on_change(self.get_text())
            return True
        return False

    def get_text(self):
        """Return committed buffer + pending character."""
        text = "".join(self._committed)
        if self._pending_pad is not None:
            chars = CHAR_MAP[self._pending_pad]
            text += chars[self._pending_index]
        return text

    def get_pending_pad(self):
        """Return pad currently cycling, or None."""
        return self._pending_pad

    def reset(self):
        """Clear all state."""
        self._committed.clear()
        self._pending_pad = None
        self._pending_index = 0
        self._last_press_time = 0

    def _commit_pending(self):
        """Commit the pending character to the buffer."""
        if self._pending_pad is not None:
            chars = CHAR_MAP[self._pending_pad]
            self._committed.append(chars[self._pending_index])
            self._pending_pad = None
            self._pending_index = 0
