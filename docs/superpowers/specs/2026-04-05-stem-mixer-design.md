# Stem Mixer for MK3 Controller

## Overview

Add stem mixing support to the MK3 controller mapping and skin. Stems (Drums, Bass, Other, Vocals) are already split and loaded in Mixxx's NI stem format. This feature adds hardware control for per-stem volume, pan, and mute, plus a dedicated stem mixer screen panel.

## Mixxx Stem Control API

Mixxx exposes stem controls via the `[ChannelXStemY]` control group:

| Control | Type | Range | Description |
|---------|------|-------|-------------|
| `volume` | read/write | 0.0-1.0 | Stem volume |
| `mute` | read/write | 0 or 1 | Stem mute toggle |
| `color` | read-only | 32-bit RGB | Stem color for visual identification |

Additionally, `[ChannelX],stem_count` returns the number of stems available (typically 4).

Pan control is expected via an orientation or pan key on the same group — to be verified during implementation.

## Activation

- **Shift+mixer** toggles the stem mixer panel on the opposite screen (the non-active deck's screen).
- Shift+mixer again closes the stem mixer and returns to normal deck view.
- Stem mixer is mutually exclusive with the library panel and the normal EQ mixer panel. Opening stem mixer closes either if open.
- New state variable: `MaschineMK3.stemMixerVisible` (boolean, default false).

## Knob Mapping

When stem mixer is visible, the 4 knobs on the opposite screen's side control stems for the **active deck**:

| Active Deck | Stem mixer screen | Knobs | Function |
|-------------|-------------------|-------|----------|
| Deck A (left) | Right screen | K5-K8 | Stem 1-4 |
| Deck B (right) | Left screen | K1-K4 | Stem 1-4 |

The remaining 4 knobs stay in their normal mode (tempo, jog, etc.).

### Knob modes

- **Normal (no shift):** Knobs control stem volume (0.0-1.0).
- **Shift held:** Knobs control stem pan. Values are absolute and clamped — no wrap-around. 0% is minimum, 100% is maximum.

Clamping uses the existing `adjustValue()` function with min/max parameters.

## Pad Mapping (Always Active)

Stem mute is **always available** on pads G1-G8, regardless of whether the stem mixer panel is visible:

| Pad | Control |
|-----|---------|
| G1 | `[Channel1Stem1],mute` (Drums, Deck A) |
| G2 | `[Channel1Stem2],mute` (Bass, Deck A) |
| G3 | `[Channel1Stem3],mute` (Other, Deck A) |
| G4 | `[Channel1Stem4],mute` (Vox, Deck A) |
| G5 | `[Channel2Stem1],mute` (Drums, Deck B) |
| G6 | `[Channel2Stem2],mute` (Bass, Deck B) |
| G7 | `[Channel2Stem3],mute` (Other, Deck B) |
| G8 | `[Channel2Stem4],mute` (Vox, Deck B) |

Pressing a pad toggles the mute state for that stem.

## LED Feedback

### Pad LEDs (G1-G8) — Always Active

- **Color:** Indexed color mode (HID report 0x81, palette 0-71). The stem's RGB color from `[ChannelXStemY],color` is mapped to the nearest MK3 palette index.
- **Brightness:** Proportional to `[ChannelXStemY],volume`, scaled to 0-63 range.
- **Muted:** LED off (brightness 0).
- LEDs update via engine connections when volume or mute changes.

### Mixer Button LED

- Brightness 63 when stem mixer is active.
- Brightness 16 when inactive (same as current behavior).

## Skin Panel

A new `StemMixerPanel` in `skin.xml`, 480x272px, controlled by `[Skin],show_stem_mixer` config key.

### Layout

Vertical 4-channel design showing stems for the **active deck only**:

- **Header:** "STEMS — Deck A" or "STEMS — Deck B" depending on active deck.
- **4 columns** (~110px each with spacing), one per stem, containing:
  - Stem name label (Drums / Bass / Other / Vox) — colored with stem color
  - Vertical volume bar/fader showing current level
  - Pan indicator (left/center/right position)
  - Mute indicator (colored = unmuted, grey/empty = muted)
- **Knob labels** at top showing which hardware knobs map to which stem.
- When shift is held, visual hint that knobs control pan (label changes from "VOL" to "PAN").

### Visibility

Mutually exclusive with `MixerPanel` and `LibraryPanel`. Uses the same `<Connection>` pattern binding to `[Skin],show_stem_mixer`.

## Active Deck Switching

When the user switches the active deck while the stem mixer is visible:
- The stem mixer screen moves to the new opposite screen.
- Knob assignments update: the 4 knobs on the new opposite side now control stems for the new active deck.
- The panel header updates to show the new active deck name.
- Stem volume/pan connections update to the new active deck's stems.

## State Management

```
MaschineMK3.stemMixerVisible = false;
```

When `stemMixerVisible` is set to true:
- `mixerVisible` is set to false
- `libraryVisible` is set to false
- `[Skin],show_stem_mixer` is set to 1
- `[Skin],show_mixer` is set to 0
- `[Skin],show_library` is set to 0

When `stemMixerVisible` is set to false:
- `[Skin],show_stem_mixer` is set to 0

## Implementation Scope

### JavaScript mapping changes (`Native-Instruments-Maschine-MK3.js`)

1. Add `stemMixerVisible` state variable.
2. Handle shift+mixer in `onButtonPress` — toggle stem mixer, update panels.
3. Add stem volume/pan knob handling in `onKnobChange` when stem mixer is visible.
4. Add stem mute toggle on G1-G8 pad press (always active).
5. Add stem LED update logic — color from stem color, brightness from volume, off when muted.
6. Register engine connections for stem volume/mute/color changes to update LEDs.
7. RGB-to-palette-index mapping function for stem colors.

### Skin changes (`skin.xml`)

1. Add `show_stem_mixer` config attribute (default 0).
2. Add `StemMixerPanel` widget group with 4 stem channel columns.
3. Add connections to `[ChannelXStemY]` controls for volume bars, mute indicators.
4. Add pan indicator widgets.
5. Add conditional visibility tied to active deck (show Channel1 or Channel2 stems).
6. Ensure mutual exclusivity with MixerPanel visibility.
