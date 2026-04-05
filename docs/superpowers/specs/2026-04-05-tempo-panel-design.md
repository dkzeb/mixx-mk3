# Tempo Panel Design

**Date:** 2026-04-05
**Status:** Draft

## Overview

Add a tempo control panel to the MK3 controller mapping, activated by the hardware TEMPO button. The panel provides tempo adjustment, key control, sync, and an automated tempo ramp feature that gradually transitions one deck's BPM toward a target.

## Panel Activation

- The TEMPO hardware button toggles `[Skin],show_tempo` config key
- Both deck screens are replaced (`hide_deck_a` and `hide_deck_b` set to 1)
- Mutual exclusion with other panels: opening tempo closes mixer/library/stem mixer and vice versa
- Pressing TEMPO again closes the panel and restores deck screens
- The TEMPO button LED lights up when the panel is open

## Screen Layout

Each of the two 480x272 screens shows one deck's tempo information:

**Left screen = Deck A, Right screen = Deck B**

Layout (top to bottom):
1. **D-button label bar** (top, 24px): Labels for D1-D4 (left) / D5-D8 (right) — positioned at top to match physical D-button placement above the screens
2. **BPM display** (center, large): Current BPM in large text, with original BPM and pitch % below
3. **Knob indicator row**: Visual representation of which knobs control what

### Ramp Active State

When a ramp is active on a deck, that deck's screen changes:
- BPM text color changes (blue/cyan accent)
- "RAMPING → DECK B" label appears above BPM
- Target BPM shown below current BPM
- Progress bar showing ramp completion
- D-button label changes from "RAMP→B" to "STOP RAMP"

## Knob Assignments

While the tempo panel is open, knobs are reassigned:

| Knob | Function | Mixxx Control | Notes |
|------|----------|---------------|-------|
| K1 | Tempo adjust (Deck A) | `[Channel1],rate` | Same as default mapping — no change needed |
| K2 | Key adjust (Deck A) | `[Channel1],pitch_adjust` | Semitone increments |
| K3 | Unused | — | Reserved for future use |
| K4 | Ramp target (Deck A) | — | Turn to cycle ramp target: 1x → ½x → 2x (and back). Sticky feel — accumulates knob delta, steps every ~33% of a full rotation. See Ramp Target Selection. |
| K5 | Tempo adjust (Deck B) | `[Channel2],rate` | Same as default mapping — no change needed |
| K6 | Key adjust (Deck B) | `[Channel2],pitch_adjust` | Semitone increments |
| K7 | Unused | — | Reserved for future use |
| K8 | Ramp target (Deck B) | — | Turn to cycle ramp target: 1x → ½x → 2x (and back). Sticky feel — accumulates knob delta, steps every ~33% of a full rotation. See Ramp Target Selection. |

Note: K1/K5 already control `rate` in the default mapping. Since the tempo panel doesn't need to change their assignment, they continue working as-is. Only K2/K6 get new assignments (key adjust) that differ from their default behavior.

## D-Button Assignments

While the tempo panel is open, D-buttons are reassigned:

| Button | Function | Behavior |
|--------|----------|----------|
| D1 | Sync toggle (Deck A) | Toggle `[Channel1],sync_enabled` |
| D2 | Key lock (Deck A) | Toggle `[Channel1],keylock` |
| D3 | Ramp start/stop (Deck A) | Start ramp toward `Deck B BPM × current multiplier` (selected via K4). If ramp already active, stop it. |
| D4 | Reset tempo (Deck A) | Set `[Channel1],rate` to 0 (original track tempo) |
| D5 | Sync toggle (Deck B) | Toggle `[Channel2],sync_enabled` |
| D6 | Key lock (Deck B) | Toggle `[Channel2],keylock` |
| D7 | Ramp start/stop (Deck B) | Start ramp toward `Deck A BPM × current multiplier` (selected via K8). If ramp already active, stop it. |
| D8 | Reset tempo (Deck B) | Set `[Channel2],rate` to 0 (original track tempo) |

### D-Button LED Feedback

| Button | Off | On |
|--------|-----|-----|
| D1/D5 (Sync) | Dim | Bright green when sync is enabled |
| D2/D6 (Keylock) | Dim | Bright orange when keylock is on |
| D3/D7 (Ramp) | Dim | Bright blue while ramp is active |
| D4/D8 (Reset) | Dim | Always dim (momentary action) |

### Ramp Target Selection (K4/K8)

K4/K8 knob **rotation** selects the ramp target multiplier with a "sticky" feel — the knob accumulates delta and only steps to the next target after significant rotation (~1/3 of a full turn).

| Multiplier | Target BPM | Use Case |
|------------|------------|----------|
| 1x (default) | Opposite deck BPM × 1.0 | Match tempo for beatmixing |
| ½x | Opposite deck BPM × 0.5 | Transition to half-time |
| 2x | Opposite deck BPM × 2.0 | Transition to double-time |

**Sticky knob implementation:**

```javascript
var RAMP_TARGET_STEP_THRESHOLD = 400;  // accumulated delta needed to step (tunable)
```

- An accumulator (`rampTargetAccumA` / `rampTargetAccumB`) tracks cumulative knob delta
- When accumulator crosses `+RAMP_TARGET_STEP_THRESHOLD`, step forward (1x → ½x → 2x), clamp at 2x
- When accumulator crosses `-RAMP_TARGET_STEP_THRESHOLD`, step backward (2x → ½x → 1x), clamp at 1x
- After each step, reset accumulator to 0
- Turn right = step forward, turn left = step backward (no wrapping — clamps at ends)
- The selected multiplier is shown on screen next to the knob indicator for K4/K8
- Changing target mid-ramp immediately updates the ramp destination (no restart needed)
- Default is 1x on init

### D-Button Screen Labels

The bottom bar of each tempo panel screen shows dynamic labels for D-buttons. These labels update to reflect current state:

| Button | Default Label | Active State Label |
|--------|--------------|-------------------|
| D1/D5 | "SYNC" | "SYNC" (bright when enabled) |
| D2/D6 | "KEYLOCK" | "KEYLOCK" (bright when enabled) |
| D3/D7 | "RAMP→B" / "RAMP→A" | "STOP RAMP" while ramping |
| D4/D8 | "RESET" | "RESET" |

## Ramp Engine

### Implementation

The ramp uses `engine.beginTimer(interval, callback)` to create a background timer that incrementally adjusts the deck's `rate` control toward the target BPM.

### Configuration

```javascript
var RAMP_BPM_PER_SEC = 2.0;    // BPM change per second (configurable)
var RAMP_INTERVAL_MS = 50;      // Timer tick interval in milliseconds
var RAMP_THRESHOLD_BPM = 0.05;  // Stop when within this many BPM of target
```

### Algorithm (per tick)

1. Read current deck BPM: `engine.getValue("[ChannelX]", "bpm")`
2. Read target deck BPM: `engine.getValue("[ChannelY]", "bpm")`
3. Compute BPM delta per tick: `RAMP_BPM_PER_SEC * (RAMP_INTERVAL_MS / 1000)`
4. If `abs(currentBpm - targetBpm) <= RAMP_THRESHOLD_BPM`: stop ramp (target reached)
5. Otherwise: compute new rate value and apply via `engine.setValue("[ChannelX]", "rate", newRate)`

### Rate Calculation

Mixxx `rate` control ranges from -1 to 1, where 0 = original tempo. The relationship between `rate` and BPM depends on the rate range setting. To convert BPM delta to rate delta:

```
rateDelta = bpmDelta / (originalBpm * rateRange * 2)
```

Where:
- `originalBpm` = `engine.getValue("[ChannelX]", "file_bpm")`
- `rateRange` = `engine.getValue("[ChannelX]", "rateRange")` (e.g., 0.08 for ±8%)

### Stop Conditions

- BPM reaches within `RAMP_THRESHOLD_BPM` of target (auto-stop)
- User presses ramp D-button again (manual cancel)
- User enables sync on the ramping deck (sync takes over)
- User loads a new track on the ramping deck

### Ramp Survives Panel Close

The timer runs independently of panel visibility. Closing the tempo panel does NOT stop an active ramp. The ramp continues adjusting tempo in the background.

## Ramp Indicators (Outside Tempo Panel)

When a ramp is active and the tempo panel is closed, two indicators are shown:

### 1. TEMPO Button LED Pulse

- The TEMPO button LED pulses between brightness 0 and 63 on a ~500ms cycle
- A separate `engine.beginTimer(500, callback)` toggles the LED state
- LED pulse stops when all ramps complete
- When no ramp is active and tempo panel is closed, LED is off
- When no ramp is active and tempo panel is open, LED is solid on

### 2. Deck Screen Ramp Label

- A small label widget is added to the normal deck screen layout in skin.xml
- Positioned near the existing BPM display
- Shows "RAMP→B" (on Deck A) or "RAMP→A" (on Deck B)
- Visibility controlled by `[Skin],show_ramp_a` and `[Skin],show_ramp_b` config keys
- JS sets these keys when ramp starts/stops

## State Management

```javascript
MaschineMK3.tempoState = {
    rampTimerA: 0,           // engine.beginTimer ID for Deck A ramp (0 = inactive)
    rampTimerB: 0,           // engine.beginTimer ID for Deck B ramp (0 = inactive)
    rampMultiplierA: 0,      // current index into RAMP_MULTIPLIERS: 0=1x, 1=0.5x, 2=2x
    rampMultiplierB: 0,      // current index into RAMP_MULTIPLIERS: 0=1x, 1=0.5x, 2=2x
    rampTargetAccumA: 0,     // knob delta accumulator for K4 sticky stepping
    rampTargetAccumB: 0,     // knob delta accumulator for K8 sticky stepping
    rampLedTimer: 0,         // engine.beginTimer ID for LED pulse animation
    rampLedState: false,     // current LED pulse on/off state
};

// Multiplier lookup: index 0 = 1x, 1 = 0.5x, 2 = 2x
var RAMP_MULTIPLIERS = [1.0, 0.5, 2.0];
```

## Skin Changes (skin.xml)

### New Config Keys

| Key | Purpose |
|-----|---------|
| `[Skin],show_tempo` | Tempo panel visibility |
| `[Skin],show_ramp_a` | Ramp indicator on Deck A screen |
| `[Skin],show_ramp_b` | Ramp indicator on Deck B screen |

### New Widgets

1. **TempoPanel** (x2, one per screen side): Full 480x272 panel showing BPM, knob labels, D-button labels, and ramp progress. Connected to `[Skin],show_tempo`.

2. **RampIndicator** (x2, one per deck): Small label on the normal deck screen showing "RAMP→B" / "RAMP→A". Connected to `[Skin],show_ramp_a` / `[Skin],show_ramp_b`.

## JS Mapping Changes (Native-Instruments-Maschine-MK3.js)

### New/Modified Functions

| Function | Purpose |
|----------|---------|
| `MaschineMK3.toggleTempoPanel()` | Toggle tempo panel visibility, manage mutual exclusion with other panels |
| `MaschineMK3.startRamp(deck)` | Start ramp timer for specified deck toward opposite deck's BPM |
| `MaschineMK3.stopRamp(deck)` | Stop ramp timer, clean up indicators |
| `MaschineMK3.rampTick(deck)` | Timer callback — compute and apply one rate increment |
| `MaschineMK3.updateRampLed()` | Timer callback — pulse TEMPO LED while any ramp active |
| `MaschineMK3.updatePanels()` | Modified — add tempo panel to mutual exclusion logic |
| `MaschineMK3.onButtonPress()` | Modified — add TEMPO button handler, reroute D-buttons when panel open |
| `MaschineMK3.onKnobDelta()` | Modified — reroute K2/K6 to pitch_adjust when panel open |
| `MaschineMK3.cycleRampTarget(deck)` | Cycle ramp multiplier for specified deck (1x → ½x → 2x → 1x) |

### Button Handler Changes

In `onButtonPress()`, add case for `"tempo"`:
```javascript
case "tempo":
    MaschineMK3.toggleTempoPanel();
    break;
```

D-button routing when tempo panel is open:
```javascript
if (MaschineMK3.showTempoPanel) {
    // D1/D5 = sync, D2/D6 = keylock, D3/D7 = ramp, D4/D8 = reset
}
```

### Knob Routing

In `onKnobDelta()`, when tempo panel is open:
- K2 routes to `[Channel1],pitch_adjust` instead of default
- K6 routes to `[Channel2],pitch_adjust` instead of default

## Edge Cases

- **Both decks ramping simultaneously**: Allowed but unusual. Each has its own timer and target.
- **Ramp while sync enabled**: Starting a ramp disables sync on that deck first (otherwise sync fights the ramp).
- **Target deck BPM changes during ramp**: Target is re-read each tick, so the ramp follows a moving target. This is intentional — if the DJ adjusts the target deck, the ramp adapts.
- **Rate range exceeded**: If the target BPM is outside the deck's rate range, the ramp stops at the rate limit and the ramp auto-cancels.
- **Track load during ramp**: Ramp should stop when a new track is loaded. Connect to `[ChannelX],track_loaded` to detect this.
