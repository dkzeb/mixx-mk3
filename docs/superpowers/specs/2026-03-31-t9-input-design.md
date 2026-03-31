# T9 Multi-Tap Input System — Design Spec

## Overview

A reusable T9-style multi-tap text input system using the MK3's 16 pads. Mimics classic dumbphone text entry — press a pad repeatedly to cycle through its assigned characters, with a timeout to commit.

Designed as a standalone module that any feature can activate via a callback API. Initial integration: library search via `xdotool` keystroke injection.

## Pad Layout

```
[13: 1/⎵ ]  [14: 2/abc]  [15: 3/def]   [16: ⌫ backspace (dim white)]
[9: 4/ghi]  [10: 5/jkl]  [11: 6/mno]   [12: ✕ cancel (red)]
[5: 7/pqrs] [6: 8/tuv]   [7: 9/wxyz]   [8: unassigned (off)]
[1: #]      [2: 0/+]     [3: *]         [4: ✓ enter (green)]
```

### Character Maps

| Pad | T9 Key | Characters |
|-----|--------|------------|
| 13  | 1      | `⎵` (space) |
| 14  | 2      | a b c 2 |
| 15  | 3      | d e f 3 |
| 9   | 4      | g h i 4 |
| 10  | 5      | j k l 5 |
| 11  | 6      | m n o 6 |
| 5   | 7      | p q r s 7 |
| 6   | 8      | t u v 8 |
| 7   | 9      | w x y z 9 |
| 2   | 0      | 0 + |
| 1   | #      | # |
| 3   | *      | * |

Numbers are at the end of each key's cycle so letters come first.

### Special Pads

| Pad | Function | LED Color |
|-----|----------|-----------|
| 4   | Enter — commits text, fires callback, exits T9 | Green (indexed color) |
| 12  | Cancel — discards text, fires cancel callback, exits T9 | Red (indexed color) |
| 16  | Backspace — deletes last committed char, or cancels current cycling char | Dim white (mono, brightness 32) |
| 8   | Unassigned (reserved for future — e.g. toggle caps, switch to predictive) | Off |

## Multi-Tap Behavior

### Cycling
- First press on a character pad shows the first character (e.g. pad 14 → 'a')
- Subsequent presses within the timeout cycle through: a → b → c → 2 → a → ...
- The "pending" character is uncommitted until the timeout fires or a different pad is pressed

### Commit Rules
- **Timeout** (800ms after last press): commits the current character, advances cursor
- **Different pad pressed**: immediately commits current character, starts cycling on the new pad
- **Same pad after timeout**: starts a new cycle (e.g. tap 2, wait, tap 2 again = "aa")

### Backspace (pad 16)
- If a character is currently cycling (uncommitted): cancels it without committing
- If no character is cycling: deletes the last committed character from the buffer

### Enter (pad 4)
- Commits any pending character
- Fires the `onSubmit(text)` callback with the full text buffer
- Exits T9 mode

### Cancel (pad 12)
- Discards the entire text buffer (does not fire onSubmit)
- Fires the `onCancel()` callback
- Exits T9 mode

## LED Feedback

### Character Pads (1-3, 5-7, 9-11, 13-15)
- **T9 mode inactive**: pads follow normal pad mode LEDs
- **T9 mode active, idle**: dim teal/blue (indexed color ~40) to indicate available input
- **Currently cycling pad**: bright white (indexed color, full brightness) — pulses or solid to indicate "active key"
- **After commit**: returns to dim teal

### Special Pads
- Pad 4 (enter): solid green while T9 is active
- Pad 12 (cancel): solid red while T9 is active
- Pad 16 (backspace): dim white while T9 is active, brighter on press

## Architecture: Split JS + Python Daemon

Mixxx's JS engine cannot shell out, so the T9 system is split across two processes that both read the same hidraw device (Linux allows multiple concurrent readers):

### JS mapping (`Native-Instruments-Maschine-MK3.js`)
- Detects `keyboard` button press → sets `padMode = "t9"`
- Stops handling pad events for loops/effects/cues while in T9 mode
- Updates the `keyboard` button LED (bright when T9 active)
- On exit (sees `keyboard` press again, or detects enter/cancel pad): restores previous pad mode

### Python daemon (`pi-setup/mk3-t9-daemon.py`)
- Runs as a systemd service (same pattern as `mk3-settings-watcher.py` and `mk3-button-reader.py`)
- Reads HID Report 0x02 (pad pressure) from hidraw
- Detects `keyboard` button in Report 0x01 to enter/exit T9 mode
- Implements the full multi-tap state machine (cycling, timeouts, buffer)
- Controls pad LEDs via HID output endpoint (Report 0x81 — pad LEDs)
- Calls `xdotool` for library search integration

### Synchronization
Both processes see the same `keyboard` button press in Report 0x01 — they enter and exit T9 mode in lockstep. No explicit IPC needed.

**LED conflict avoidance:** During T9 mode, the JS mapping skips pad LED updates (it only writes Report 0x80 for non-pad LEDs). The Python daemon writes Report 0x81 for pad LEDs. They write to different report IDs, so there's no conflict.

## Module Structure

### T9Engine class (in `mk3-t9-daemon.py`)

Core engine, structured as a class for reuse by future plugins:

```python
class T9Engine:
    def __init__(self, on_change=None, on_submit=None, on_cancel=None):
        """Callbacks fired on text events."""
    def press(self, pad_index):
        """Handle a pad press — cycles character or triggers special action."""
    def tick(self):
        """Called from main loop — checks commit timeout."""
    def get_text(self):
        """Return current text buffer."""
    def reset(self):
        """Clear state for new input session."""
```

The daemon's main loop reads HID, feeds pad events to the engine, and wires callbacks to xdotool.

### JS mapping changes

Minimal — just pad mode gating:

```javascript
// In onButtonPress for "keyboard":
MaschineMK3.padMode = (MaschineMK3.padMode === "t9") ? null : "t9";
MaschineMK3.updatePadModeLED();
MaschineMK3.updatePadLEDs();

// In onPadPress / onPadRelease:
if (MaschineMK3.padMode === "t9") return;  // Python daemon handles pads
```

## Library Search Integration

When T9 activates while the library is open:

1. Python daemon detects `keyboard` button → enters T9 mode
2. Focuses search bar: `xdotool key --clearmodifiers ctrl+f` (or Tab to search widget)
3. On each character commit:
   - `xdotool key --clearmodifiers ctrl+a` (select all)
   - `xdotool type --clearmodifiers "<full text buffer>"` (retype entire buffer)
   - This gives search-as-you-type behavior
4. On enter (pad 4): daemon exits T9 mode, sends `xdotool key --clearmodifiers Tab` to move focus to results
5. On cancel (pad 12): daemon exits T9 mode, sends `xdotool key --clearmodifiers Escape` to clear search
6. On backspace: retypes the shortened buffer (same select-all + type pattern)

## Activation Trigger

T9 mode is entered via the **`keyboard` button** (byte 0x04, mask 0x02). Press to enter, press again to exit. Both the JS mapping and Python daemon detect this button independently from the same HID report.

## Pad Mode Interaction

- T9 is a **separate mode** from loops/effects/cuepoints — it takes over the pads entirely
- Entering T9 exits any active pad mode
- Exiting T9 (enter/cancel) returns to no pad mode (same as pressing padMode to deselect)
- The `padMode` variable gets a new value: `"t9"`

## Screen Panel (Future)

A text input panel showing the current buffer, cursor position, and active key's character options would be displayed on the non-active deck's screen. This is **deferred** — the existing skin panel system has reliability issues with the framebuffer capture pipeline. The T9 engine works entirely via pad LEDs and doesn't depend on screen output.

When the screen rendering is reliable (or QML rendering lands with Mixxx 2.7), the panel can be added as a `[Skin],show_t9` panel showing:
- Current text with cursor
- Active key's character cycle with current selection highlighted
- "T9 Input" header

## Future: Predictive T9

The multi-tap engine is designed to be extended with predictive mode:
- Pad 8 (currently unassigned) could toggle between multi-tap and predictive
- Predictive mode: each pad press narrows a dictionary lookup, suggestions shown on screen
- The `onChange` callback works the same way — consumers don't need to know which mode is active
