# MK3 Overlay Widget System

A reusable daemon that renders interactive Qt-based UI on the MK3 screens, on top of Mixxx. Reads HID input directly, traps focus from other daemons, and executes system commands. The settings menu is the first widget built on this system.

## Architecture

```
┌──────────────┐     HID input      ┌──────────────────┐
│   MK3 HW     │◄──────────────────►│  mk3-overlay     │
│  (hidraw)    │     LED output      │  daemon          │
└──────────────┘                     │                  │
                                     │  ┌────────────┐  │
┌──────────────┐    xdotool F11/F12  │  │ Widget Mgr │  │
│  Mixxx JS    │◄────────────────────│  ├────────────┤  │
│  (Xvfb :99)  │                     │  │ Settings   │  │
└──────────────┘                     │  │ ...future  │  │
                                     │  └────────────┘  │
┌──────────────┐    flag file        │                  │
│  T9/Mouse    │◄────────────────────│  Qt window on    │
│  daemons     │ /tmp/mk3-overlay-   │  Xvfb :99        │
└──────────────┘   active            └──────────────────┘
                                            │
                                     screen capture daemon
                                     picks up the Qt window
```

### Key principles

- The overlay daemon owns HID input when a widget is active (flag file pauses T9/mouse daemons).
- It renders frameless Qt windows directly on Xvfb :99 — the screen capture daemon picks them up automatically.
- Mixxx JS is notified via xdotool keystroke to hide the deck display and suppress HID processing.
- Each widget is a Python class inheriting from a base `Widget`.
- The daemon runs continuously, listening for activation buttons even when no widget is active.
- Coexists with T9 and mouse daemons via flag files (same pattern as `/tmp/mk3-mouse-active`).

## Widget Model

### Widget

Each widget declares its screen position/size and a list of pages.

```python
class Widget:
    name: str                          # e.g., "settings"
    position: (x, y, w, h)            # e.g., (0, 0, 480, 272) for left screen
    activate_button: str               # HID button name that toggles this widget
    pages: list[Page]                  # ordered list of pages
    current_page: int                  # index into pages
```

Widgets choose their own position and size. Can target the left screen (0,0, 480,272), right screen (480,0, 480,272), or any arbitrary region up to the full 960x272.

### Page

Each page has a title, a list of items, and optional hardware bindings.

```python
class Page:
    title: str                         # shown in tab bar / D-button label
    items: list[Item]                  # navigated with nav up/down
    knob_bindings: dict[str, Callable] # k1-k8 -> callback(delta), optional
    d_button_bindings: dict[str, Callable]  # d1-d8 -> callback(), optional
```

Page switching: left/right arrow buttons cycle `current_page`. D-buttons can also jump to a specific page directly (D1 -> page 0, D2 -> page 1, etc.).

### Item

```python
class Item:
    label: str
    type: "action" | "toggle" | "info" | "custom"
    # action: has on_execute callback, optional confirm=True for two-step
    # toggle: has state (bool), on_toggle callback
    # info: read-only display, cursor skips over it, has value_fn for live data
    # custom: widget provides its own rendering and input handling
```

Item navigation: nav up/down moves a cursor through selectable items (skipping `info` type). Nav push executes the highlighted item. Stepper (rotary encoder) also scrolls the cursor. Wrap-around at list boundaries.

## HID Input & Focus Trapping

### Always-listening (no widget active)

The daemon reads HID Report 0x01 continuously. When no widget is active, it only checks each registered widget's `activate_button` for edge-triggered presses. All other input is ignored (Mixxx JS and other daemons process it normally).

### Focus trap (widget active)

On activation:
1. Write `/tmp/mk3-overlay-active` flag file.
2. Send xdotool `F12` keystroke to Mixxx — JS sets `overlayActive = true`, hides the appropriate deck, suppresses its own HID processing.
3. All nav (up/down/left/right/push), stepper, D-buttons (d1-d8), knobs (k1-k8), and arrow buttons are consumed by the active widget.
4. The activation button acts as close/back (press settings again to close the settings widget).

On deactivation:
1. Remove `/tmp/mk3-overlay-active`.
2. Send xdotool `F11` keystroke — JS clears `overlayActive`, restores deck display, resumes normal HID processing.
3. Qt window is hidden (not destroyed — fast reopen).

### Coexistence with other daemons

Linux hidraw allows multiple readers. Mixxx, T9, mouse, and the overlay daemon all read the same device. Focus trapping is cooperative:
- T9 daemon: checks for `/tmp/mk3-overlay-active`, skips input processing when present.
- Mouse daemon: same check.
- Mixxx JS: F12/F11 keystroke handler sets/clears an `overlayActive` flag that suppresses HID processing in `incomingData`.

## Rendering

### Qt window

- `QWidget` subclass, frameless (`Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint`).
- Positioned via `move(x, y)` and `resize(w, h)` to match the widget's declared position.
- Background painted by `QPainter` — full repaint each frame (trivially fast at 480x272).
- No window manager chrome — pure pixel control.

### Default page layout

```
┌──────────────────────────────────┐
│ D1:GENERAL  D2:LIBRARY  D3:NET  │  tab bar (28px)
├──────────────────────────────────┤
│ > Reboot                       > │  highlighted item
│   Shutdown                     > │  normal item
│   Check for Updates            > │
│   Auto-update on boot        OFF │  toggle item
│   Version                v1.2.3  │  info item (dimmed)
│                                  │
│                                  │  remaining space empty
└──────────────────────────────────┘
```

The base class `Widget._paint_page()` provides this standard list layout. Widgets override `paint()` for custom rendering.

### Color palette

Reuses the existing MK3 skin aesthetic:

| Element | Color |
|---|---|
| Background | `#0d0d1a` |
| Item text | `#aaaaaa` |
| Highlighted item text | `#ffffff` |
| Highlighted item background | `#1a1a2e` |
| Highlight accent (left border) | `#e67e22` |
| Tab active | `#e67e22` |
| Tab inactive | `#555555` |
| Toggle ON pill | `#e67e22` bg, `#ffffff` text |
| Toggle OFF pill | `#333333` bg, `#888888` text |
| Info value text | `#555555` |
| Confirmation text | `#e74c3c` on `#2a1a1a` bg |

### LED feedback

The daemon writes LED reports (0x80/0x81) to hidraw when a widget is active:
- D-buttons lit for page tabs (active = bright 63, available = dim 16).
- Widget's activation button lit bright (e.g., settings LED = 63).
- All other button LEDs managed by the widget as needed.

## Settings Widget

The first widget built on the system. Replaces the skin-based settings panel and the `mk3-settings-watcher.py` daemon.

### Activation

Button: `settings` (byte 0x07, mask 0x02). Renders at 480x272 on the non-active deck's screen side.

### Pages

**Page 0 — GENERAL**

| Item | Type | Behavior |
|---|---|---|
| Reboot | action (confirm) | `sudo reboot` |
| Shutdown | action (confirm) | `sudo shutdown -h now` |
| Check for Updates | action | runs `mk3-update.sh` |
| Auto-update on boot | toggle | writes/removes `/etc/mk3-autoupdate` |
| Version | info | reads git tag or version file at startup |

**Page 1 — LIBRARY**

| Item | Type | Behavior |
|---|---|---|
| Rescan Library | action | sends xdotool keystroke (F10), JS calls `engine.setValue("[Library]", "rescan", 1)` |
| Mount USB Drive | action | finds + mounts first unmounted USB block device |
| Unmount USB Drive | action | unmounts `/media/usb-*` |
| Library Location | info | shows path from Mixxx config |

**Page 2 — NETWORK**

| Item | Type | Behavior |
|---|---|---|
| IP Address | info | `hostname -I` |
| Hostname | info | `socket.gethostname()` |
| WiFi Network | info | `iwgetid -r` |
| WiFi Select | action | stub: shows "Not yet implemented" on execute |
| Tailscale | toggle | `sudo tailscale up` / `sudo tailscale down` |
| Hotspot | toggle | stub: shows "Not yet implemented" on execute |

### Info refresh

Info item values are refreshed each time the user navigates to a page (on page enter). No continuous polling.

### Confirmation flow

Destructive actions (Reboot, Shutdown) require two-step confirmation:
1. First push: item text changes to "Are you sure? Push to confirm".
2. Second push within 5 seconds: executes the command.
3. Moving the cursor or 5-second timeout cancels confirmation.

### Rescan Library bridge

The one command that needs Mixxx involvement. The widget sends an F10 keystroke via xdotool. The JS mapping handles F10 by calling `engine.setValue("[Library]", "rescan", 1)`. This is a dedicated single-purpose keystroke.

## File Structure

```
pi-setup/
  mk3-overlay/
    __init__.py
    daemon.py          # Entry point: QApplication, HID poll timer, widget manager
    hid.py             # hidraw discovery, report parsing, LED report writing
    widget.py          # Widget/Page/Item base classes and dataclasses
    renderer.py        # QPainter rendering: page layout, item styles, tab bar
    focus.py           # Focus trap: flag file management, xdotool signaling
    widgets/
      __init__.py
      settings.py      # Settings widget: pages, items, system command execution
  mk3-overlay.service  # systemd unit file
```

## Daemon Lifecycle

1. Systemd starts `mk3-overlay` after `openbox.service` (Xvfb must be running).
2. Daemon initializes `QApplication`, discovers and opens hidraw device.
3. `QTimer` at ~16ms interval polls HID (non-blocking read) — keeps Qt event loop responsive.
4. When no widget active: only check activation buttons in each HID report.
5. When widget active: route full input to active widget, repaint Qt window on state change.
6. On HID read error (device disconnect): close fd, retry discovery every 3 seconds.

### Systemd service

```ini
[Unit]
Description=MK3 Overlay Widget System
After=openbox.service
Requires=openbox.service

[Service]
Type=simple
User=pi
Environment=DISPLAY=:99
ExecStart=/usr/bin/python3 /home/pi/mixx-mk3/pi-setup/mk3-overlay/daemon.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

## Backlog

### Emulator support

A homemade MK3 emulator exists (will be available as a git submodule in its own repo). The overlay daemon — and potentially Mixxx on Xvfb — could run against it on a dev machine with no physical hardware. This would enable a fully local development loop: the emulator provides a virtual hidraw device and renders screen output, so the overlay system can be developed and tested without the Pi + MK3 setup. Not in scope for initial implementation but the HID abstraction layer (`hid.py`) should avoid assumptions that would prevent this (e.g., don't hardcode `/dev/hidraw*` discovery — accept a device path override).

## Changes to Existing Code

### JS mapping (Native-Instruments-Maschine-MK3.js)

**Add:**
- F12 keyboard handler: sets `MaschineMK3.overlayActive = true`, calls `updatePanels()` to hide non-active deck.
- F11 keyboard handler: sets `MaschineMK3.overlayActive = false`, calls `updatePanels()` to restore.
- F10 keyboard handler: calls `engine.setValue("[Library]", "rescan", 1)`.
- Guard in `incomingData`: when `overlayActive` is true, skip all HID processing except modifier tracking.

**Remove:**
- `settingsVisible`, `settingsTab`, `settingsCursor`, `settingsConfirm`, `settingsConfirmTimer` state.
- `settingsTabs` definition and all toggle state (`settingsAutoUpdate`, `settingsTailscale`, `settingsHotspot`).
- `settingsNextSelectable()`, `settingsFirstSelectable()`.
- `updateSettingsSkinCOs()`, `updateSettingsLEDs()`, `settingsExecuteItem()`, `settingsDispatchCommand()`.
- All settings-specific input handling in the button switch statement (settings tab switching, settings cursor movement, settings nav-push execution).
- Settings references in `updatePanels()`.

### Skin XML (skin.xml)

**Remove:**
- The entire `SettingsPanel` widget group (lines ~457-778).
- All `settings_*` skin CO attribute declarations (lines ~23-36).

### Style QSS (style.qss)

**Remove:**
- All `#Settings*` style rules (SettingsPanel, SettingsTabBar, SettingsTabActive, SettingsTabInactive, SettingsItem, SettingsItemHighlight, SettingsItemInfo, SettingsChevron, SettingsChevronHighlight, SettingsToggleOn, SettingsToggleOff, SettingsConfirm).

### T9 daemon (mk3-t9-daemon.py)

**Add:**
- Check for `/tmp/mk3-overlay-active` at top of input processing loop. When present, skip all button/pad processing.

### Mouse daemon (mk3-mouse-daemon.py)

**Add:**
- Same `/tmp/mk3-overlay-active` check. When present, skip all input processing.

### Removed files

- `mk3-settings-watcher.py` — functionality absorbed into settings widget.
- `mk3-settings-watcher.service` — replaced by `mk3-overlay.service`.
- `mk3-settings-menu.sh` — zenity menu no longer needed.

### Setup script (mk3-pi-setup.sh)

**Update:**
- Install `python3-pyqt5` dependency.
- Install `mk3-overlay.service` instead of `mk3-settings-watcher.service`.
- Remove `mk3-settings-menu.sh` installation.
