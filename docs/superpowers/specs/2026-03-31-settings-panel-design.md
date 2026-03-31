# Settings Panel Design

## Summary

A tabbed settings panel rendered on the MK3 screen, navigated with D buttons (tabs) and the 4D nav encoder (items). Replaces the current single-panel settings with a 3-tab system: General, Library, Network. When settings is open, the D buttons on that screen's side switch tabs; closing settings restores normal D-button DJ behavior.

## Screen Layout

The panel occupies the full 480x272 screen on the non-active deck's side.

```
┌──────────┬──────────┬──────────┬──────────┐
│ GENERAL  │ LIBRARY  │ NETWORK  │          │  ← tab bar (28px), D buttons select
├──────────┴──────────┴──────────┴──────────┤
│▎ Reboot                              ›    │  ← highlighted item (orange left bar)
│  Shutdown                             ›    │  ← action item (chevron)
│  Auto-update on boot              [===]   │  ← toggle item (switch)
│  Check for Updates                    ›    │  ← action item
│  Version                          1.2.3   │  ← info item (dimmed, not selectable)
│                                        ▐  │  ← scroll indicator
└───────────────────────────────────────────┘
```

- Active tab: bright text + orange underline. Inactive tabs: dimmed text.
- No D-button labels on screen — physical placement makes it obvious.
- Scroll indicator on the right edge when list exceeds visible area.

## Item Types

| Type | Right indicator | NavPush behavior | Selectable |
|------|----------------|------------------|------------|
| Action | `›` chevron | Execute (or confirm for destructive) | Yes |
| Toggle | Switch graphic (on=orange, off=grey) | Toggle on/off | Yes |
| Info | Value text (dimmed) | No-op | No (cursor skips) |

## Tab Content

### General (D1 or D5)

| Item | Type | Notes |
|------|------|-------|
| Reboot | Action | Confirmation required |
| Shutdown | Action | Confirmation required |
| Check for Updates | Action | Runs mk3-update.sh |
| Auto-update on boot | Toggle | Persisted to config |
| Version | Info | Shows current git tag or commit |

### Library (D2 or D6)

| Item | Type | Notes |
|------|------|-------|
| Rescan Library | Action | Triggers Mixxx library rescan |
| Mount USB Drive | Action | Detects and mounts available USB block devices |
| Unmount USB Drive | Action | Only visible when a USB is currently mounted |
| Library Location | Info | Shows current library path |

### Network (D3 or D7)

| Item | Type | Notes |
|------|------|-------|
| IP Address | Info | Current LAN IP |
| Hostname | Info | System hostname |
| WiFi Network | Info | Current SSID |
| WiFi Select | Action | Future expansion — submenu for network selection |
| Tailscale | Toggle | Enable/disable Tailscale VPN (only shown when Tailscale is set up) |
| Setup VPN | Action | Shown instead of Tailscale toggle when not configured. Runs `tailscale up`, renders auth URL as QR code on the MK3 screen for phone scanning. |
| Hotspot | Toggle | Enable/disable WiFi hotspot mode |

### Tailscale Setup Flow

Tailscale can be configured either during initial Pi setup (`mk3-pi-setup.sh` prompts for it) or later via the Settings > Network > "Setup VPN" action.

**Setup flow (from settings):**
1. User selects "Setup VPN" — triggers `tailscale up` via the command executor daemon.
2. `tailscale up` returns an auth URL (e.g. `https://login.tailscale.com/a/...`).
3. The daemon converts the URL to a QR code (via `qrencode`) and renders it on the MK3 screen.
4. User scans QR code with their phone to authenticate.
5. Once authenticated, `tailscale status` confirms connection. The "Setup VPN" item is replaced by the Tailscale toggle.

**Setup flow (from Pi setup script):**
1. `mk3-pi-setup.sh` installs Tailscale (`curl -fsSL https://tailscale.com/install.sh | sh`).
2. Prompts: "Set up Tailscale VPN now? (y/n)".
3. If yes, runs `tailscale up` and displays the auth URL in the terminal for the user to visit.
4. If no, Tailscale is installed but not configured — the settings panel will show "Setup VPN" later.

**Dependencies:** `tailscale` package, `qrencode` (for QR rendering on screen).

## Navigation

- **Settings button**: Toggle settings panel open/closed. Closing restores normal D-button behavior.
- **D1-D4 or D5-D8** (depending on which screen): Switch active tab. Which set is used depends on `activeDeck` — if active deck is 1, settings is on the right screen so D5-D8 are tabs; if active deck is 2, settings is on the left screen so D1-D4.
- **Nav Up/Down**: Move highlight cursor through selectable items. Skips info-only items. Wraps at top/bottom.
- **Nav Push**: Execute the highlighted item's action or toggle its state.
- **Any other button**: Ignored by settings (passes through to normal handler).

## Confirmation Flow

Destructive actions (Reboot, Shutdown) require a two-step confirmation:

1. NavPush on the item changes its text to `"Are you sure? Push to confirm"` and highlights it in a warning style.
2. NavPush again within this state executes the action.
3. Any other input (nav up/down, tab switch, or timeout ~5s) cancels and restores the original item text.

## System Command Execution

Mixxx JS cannot execute system commands directly. A background service handles this:

- The JS mapping writes a command identifier to a well-known file (e.g. `/tmp/mk3-settings-cmd`).
- The existing `mk3-settings-watcher.py` daemon is repurposed: instead of watching for HID button presses, it watches the command file and executes the requested action.
- Commands: `reboot`, `shutdown`, `update`, `rescan`, `mount-usb`, `unmount-usb`, `tailscale-up`, `tailscale-down`, `tailscale-setup`, `hotspot-on`, `hotspot-off`.
- The daemon writes results/status back to a response file that the JS mapping can poll or that the skin can read.

Alternative: use Mixxx's `system()` if available in the JS engine, which would simplify this. To be determined during implementation.

## State Management (JS)

New state variables in the JS mapping:

```javascript
MaschineMK3.settingsVisible = false;    // panel open/close
MaschineMK3.settingsTab = 0;            // 0=General, 1=Library, 2=Network
MaschineMK3.settingsCursor = 0;         // index into current tab's selectable items
MaschineMK3.settingsConfirm = false;    // true when awaiting destructive confirmation
```

## Skin Implementation

The settings panel in skin.xml is a single `WidgetGroup` bound to `[Skin],show_settings`. Tab content and item rendering are driven by skin COs set from JS:

- `[Skin],settings_tab` — which tab is active (controls visibility of tab content groups)
- Individual item labels and values are set via `[Skin],settings_item_N_text`, `[Skin],settings_item_N_value`, etc.
- Cursor position highlighted via `[Skin],settings_cursor`

The exact skin CO scheme may be simplified during implementation — the Mixxx skin system has limitations on dynamic content. An alternative is rendering the full list in JS and pushing it as pre-formatted label text.

## LED Feedback

- **Settings button LED**: Bright (63) when open, dim (16) when closed.
- **D-button LEDs** (when settings is open): Active tab's D button = bright, others = dim. When settings closes, D-button LEDs restore to normal deck function state.

## Files Changed

| File | Changes |
|------|---------|
| `mapping/Native-Instruments-Maschine-MK3.js` | Settings state, tab switching, cursor navigation, D-button repurposing, confirmation flow, command dispatch |
| `skin/MK3/skin.xml` | Settings panel with tab groups, item rows, cursor highlight, tab bar |
| `pi-setup/mk3-settings-watcher.py` | Repurpose to command executor (watch file instead of HID) |
| `pi-setup/mk3-settings-watcher.service` | May need minor updates for new daemon behavior |
