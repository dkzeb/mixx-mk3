# Mouse Mode — Design Spec

## Overview

A toggle-activated mouse mode that lets the MK3's 4D encoder control the system cursor, enabling interaction with dialogs and UI elements without a physical mouse.

## Activation

- **Toggle combo:** Press Auto (`0x08` / `0x20`) + Macro (`0x07` / `0x01`) simultaneously
- "Simultaneously" means both are held when the second button's press edge is detected
- Toggle on: enter mouse mode. Toggle off: exit mouse mode.
- Activating mouse mode deactivates T9 mode (and vice versa)
- Auto + Macro LEDs set to full brightness (63) while mouse mode is active; turned off on deactivate

## Implementation Approach

Standalone Python daemon (`mk3-mouse-daemon.py`) following the T9 daemon pattern:
- Reads HID reports from hidraw
- Injects mouse movement/clicks via `xdotool`
- Controls Auto/Macro LEDs via HID Report `0x80`
- Runs as a systemd service alongside the T9 daemon

## Input Mapping

| Input | Action |
|---|---|
| navUp (byte `0x01`, mask `0x04`) | Move cursor up by `speed` px |
| navDown (byte `0x01`, mask `0x10`) | Move cursor down by `speed` px |
| navLeft (byte `0x01`, mask `0x20`) | Move cursor left by `speed` px |
| navRight (byte `0x01`, mask `0x08`) | Move cursor right by `speed` px |
| navPush (byte `0x01`, mask `0x01`) | Left click (`xdotool click 1`) |
| Shift + navPush | Right click (`xdotool click 3`) |
| Stepper CW | Increase movement speed |
| Stepper CCW | Decrease movement speed |

### Shift Button

- Shift: byte `0x01`, mask `0x40` (track shift state for right-click combo)

## Movement Speed

- **Range:** 1–30 px per nav press
- **Default:** 8 px
- **Stepper adjustment:** Each click ±1 (or ±2 at extremes for faster adjustment)
- Speed resets to default when mouse mode is deactivated

## Held-Button Repeat

Nav directional buttons are continuously processed — while held, each HID poll cycle (~8ms) moves the cursor. This gives smooth continuous movement without needing a separate repeat timer.

## Cursor Visibility

The headless Pi likely runs Xvfb with a hidden or default cursor. To make the cursor visible on the MK3 screens (which mirror the framebuffer):

- Set a visible X11 cursor theme on the Pi's X server
- The screen capture daemon already mirrors the framebuffer, so a visible system cursor automatically appears on the MK3 screens
- No custom overlay rendering needed

## LED Feedback

- **Auto button LED:** Report `0x80`, byte 11 — mono brightness 0–63
- **Macro button LED:** Report `0x80`, byte 12 — mono brightness 0–63
- Both set to 63 (full) when mouse mode is active, 0 when inactive

## Daemon Coordination

- T9 daemon and mouse daemon both read from the same hidraw device
- Each daemon watches its own toggle combo and ignores HID data when inactive
- When mouse mode activates, it should deactivate T9 (write a known signal, or simply: each daemon watches the other's toggle buttons and self-deactivates)
- Simplest approach: each daemon independently tracks both toggle combos. When the mouse daemon sees the T9 toggle pressed, it knows T9 is handling things and stays/goes inactive. Similarly for T9 daemon seeing Auto+Macro.

## Files

| File | Purpose |
|---|---|
| `pi-setup/mk3-mouse-daemon.py` | Mouse mode daemon |
| `pi-setup/mk3-mouse-daemon.service` | systemd unit file |
