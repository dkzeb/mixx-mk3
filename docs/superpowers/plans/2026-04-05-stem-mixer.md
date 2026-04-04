# Stem Mixer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stem mixing support to the MK3 controller — G1-G8 always mute stems with color/brightness LED feedback, shift+mixer opens a stem mixer panel on screen, knobs control stem volume (or pan when shift held).

**Architecture:** Three layers of changes: (1) JavaScript mapping adds stem state, mute pads, knob routing, LED feedback via engine connections. (2) Skin XML adds a StemMixerPanel showing 4 stem channels for the active deck. (3) `updatePanels()` gains stem mixer awareness for mutual exclusivity.

**Tech Stack:** Mixxx HID JS mapping API, Mixxx skin XML, `[ChannelXStemY]` engine controls (volume, mute, color).

**Spec:** `docs/superpowers/specs/2026-04-05-stem-mixer-design.md`

---

### Task 1: Add stem state and G-button mute logic

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:300-310` (state section)
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:784-797` (G button press handler)
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:991-998` (G button release handler)

- [ ] **Step 1: Add stemMixerVisible state variable**

Add after line 308 (`mixerVisible`):

```javascript
MaschineMK3.stemMixerVisible = false;    // whether the stem mixer panel is shown
```

- [ ] **Step 2: Replace G-button hotcue logic with stem mute**

Replace the G1-G8 case in `onButtonPress` (lines 784-797) with stem mute toggles:

```javascript
    // --- G1-G8: Always toggle stem mute (G1-G4 = Deck A, G5-G8 = Deck B) ---
    case "g1": case "g2": case "g3": case "g4":
    case "g5": case "g6": case "g7": case "g8":
        var gIdx = parseInt(name.charAt(1), 10);  // 1-8
        var gDeck = gIdx <= 4 ? 1 : 2;
        var gStem = gIdx <= 4 ? gIdx : gIdx - 4;  // stem 1-4
        var stemGroup = "[Channel" + gDeck + "Stem" + gStem + "]";
        var muted = engine.getValue(stemGroup, "mute");
        engine.setValue(stemGroup, "mute", muted ? 0 : 1);
        break;
```

- [ ] **Step 3: Remove G-button hotcue deactivation from onButtonRelease**

Replace the G1-G8 case in `onButtonRelease` (lines 991-998) — stem mute is a toggle, no release action needed:

```javascript
    // G button releases — no action needed (stem mute is toggle)
    case "g1": case "g2": case "g3": case "g4":
    case "g5": case "g6": case "g7": case "g8":
        break;
```

- [ ] **Step 4: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(stems): add stem state and G-button mute toggles

Replace G1-G8 hotcue logic with stem mute toggles.
G1-G4 = Deck A stems 1-4, G5-G8 = Deck B stems 1-4."
```

---

### Task 2: Add stem LED feedback (color + brightness from volume, off when muted)

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:268-279` (color palette section)
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:1436` (init function)
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:1458-1476` (remove old G button LED logic)

- [ ] **Step 1: Add RGB-to-palette-index mapping function**

Add after the `MaschineMK3.Color` object (after line 279):

```javascript
// ---------------------------------------------------------------------------
// rgbToPaletteIndex — map a Mixxx 32-bit RGB color to the nearest MK3 LED
// palette index (0-71). The MK3 palette has 18 hues x 4 brightness levels.
// We match on hue only and use brightness level 3 (brightest variant).
// ---------------------------------------------------------------------------
MaschineMK3.rgbToPaletteIndex = function(rgb) {
    var r = (rgb >> 16) & 0xFF;
    var g = (rgb >> 8) & 0xFF;
    var b = rgb & 0xFF;

    // Default colors for each stem if color is 0/black
    if (r === 0 && g === 0 && b === 0) { return MaschineMK3.Color.WHITE; }

    // Simple hue-based mapping to palette regions
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    if (max === 0) { return MaschineMK3.Color.WHITE; }

    var hue = 0;
    var delta = max - min;
    if (delta === 0) { return MaschineMK3.Color.WHITE; } // grey

    if (max === r) {
        hue = ((g - b) / delta) % 6;
    } else if (max === g) {
        hue = (b - r) / delta + 2;
    } else {
        hue = (r - g) / delta + 4;
    }
    hue = Math.round(hue * 60);
    if (hue < 0) { hue += 360; }

    // Map hue ranges to MK3 palette indices
    var C = MaschineMK3.Color;
    if (hue < 15 || hue >= 345) { return C.RED; }
    if (hue < 45)  { return C.ORANGE; }
    if (hue < 75)  { return C.YELLOW; }
    if (hue < 150) { return C.GREEN; }
    if (hue < 195) { return C.CYAN; }
    if (hue < 255) { return C.BLUE; }
    if (hue < 300) { return C.PURPLE; }
    return C.PINK;
};
```

- [ ] **Step 2: Add updateStemLEDs function**

Add after `rgbToPaletteIndex`:

```javascript
// ---------------------------------------------------------------------------
// updateStemLEDs — set G1-G8 LED color/brightness from stem state.
// Color = stem color mapped to palette. Brightness = volume (0-63). Off when muted.
// ---------------------------------------------------------------------------
MaschineMK3.updateStemLEDs = function() {
    for (var deck = 1; deck <= 2; deck++) {
        for (var stem = 1; stem <= 4; stem++) {
            var gName = "g" + ((deck - 1) * 4 + stem);
            var stemGroup = "[Channel" + deck + "Stem" + stem + "]";
            var muted = engine.getValue(stemGroup, "mute");
            if (muted) {
                MaschineMK3.setLed(gName, MaschineMK3.Color.OFF);
            } else {
                var color = engine.getValue(stemGroup, "color");
                var paletteIdx = MaschineMK3.rgbToPaletteIndex(color);
                // G LEDs use indexed color mode — the palette index encodes
                // both hue and brightness. We use the base palette index
                // (brightest level) and scale down based on volume.
                // Palette layout: each hue has 4 entries (dim to bright).
                // Base index is the brightest (index+3). We interpolate.
                var volume = engine.getValue(stemGroup, "volume");
                var brightnessLevel = Math.round(volume * 3); // 0-3
                var ledValue = paletteIdx + brightnessLevel;
                if (ledValue < 1) { ledValue = 1; } // minimum visible
                MaschineMK3.setLed(gName, ledValue);
            }
        }
    }
};
```

- [ ] **Step 3: Replace old G-button LED init with stem LED connections**

Remove the old `updateGButtonLEDs` function and its connections in `init()` (lines 1458-1476) and replace with:

```javascript
    // --- G button LED feedback: stem mute/volume/color ---
    for (var deck = 1; deck <= 2; deck++) {
        for (var stem = 1; stem <= 4; stem++) {
            (function(d, s) {
                var stemGroup = "[Channel" + d + "Stem" + s + "]";
                engine.makeConnection(stemGroup, "mute",
                    function() { MaschineMK3.updateStemLEDs(); });
                engine.makeConnection(stemGroup, "volume",
                    function() { MaschineMK3.updateStemLEDs(); });
                engine.makeConnection(stemGroup, "color",
                    function() { MaschineMK3.updateStemLEDs(); });
            })(deck, stem);
        }
    }
    MaschineMK3.updateStemLEDs();
```

- [ ] **Step 4: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(stems): add stem LED feedback on G1-G8

Color from stem color mapped to MK3 palette, brightness from volume,
off when muted. Updates via engine connections on mute/volume/color."
```

---

### Task 3: Add shift+mixer toggle for stem mixer panel

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:907-917` (mixer button press handler)
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:425-468` (updatePanels function)

- [ ] **Step 1: Add shift+mixer handling in onButtonPress**

Replace the mixer case (lines 907-917) with:

```javascript
    // --- Mixer: toggle mixer panel; Shift+mixer: toggle stem mixer ---
    case "mixer":
        if (MaschineMK3.shiftPressed) {
            // Shift+mixer: toggle stem mixer
            MaschineMK3.stemMixerVisible = !MaschineMK3.stemMixerVisible;
            if (MaschineMK3.stemMixerVisible) {
                MaschineMK3.mixerVisible = false;
                MaschineMK3.libraryVisible = false;
                MaschineMK3.cueDisplayVisible = false;
            }
        } else {
            // Normal mixer toggle (unchanged)
            MaschineMK3.mixerVisible = !MaschineMK3.mixerVisible;
            if (MaschineMK3.mixerVisible) {
                MaschineMK3.libraryVisible = false;
                MaschineMK3.stemMixerVisible = false;
            }
        }
        if (MaschineMK3.padMode === "t9") { MaschineMK3.padMode = "cuepoints"; }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updatePanels();
        break;
```

- [ ] **Step 2: Update updatePanels to handle stem mixer visibility**

Replace `updatePanels` (lines 428-468) with:

```javascript
MaschineMK3.updatePanels = function() {
    var showLib = MaschineMK3.libraryVisible;
    var showMix = MaschineMK3.mixerVisible;
    var showStemMix = MaschineMK3.stemMixerVisible;
    var noPanelOpen = !showLib && !showMix && !showStemMix;
    var showPadsLoops = noPanelOpen && MaschineMK3.padMode === "loops";
    var showPadsFx = noPanelOpen && MaschineMK3.padMode === "effects";
    var showPadsCues = noPanelOpen && MaschineMK3.cueDisplayVisible;
    var anyPanel = showLib || showMix || showStemMix || showPadsLoops || showPadsFx || showPadsCues;

    engine.setValue("[Skin]", "show_library", showLib ? 1 : 0);
    engine.setValue("[Skin]", "show_mixer", showMix ? 1 : 0);
    engine.setValue("[Skin]", "show_stem_mixer", showStemMix ? 1 : 0);
    engine.setValue("[Skin]", "show_t9", showLib ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_loops", showPadsLoops ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_fx", showPadsFx ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_cues", showPadsCues ? 1 : 0);

    if (showLib) {
        // Library: always left screen, T9 pad overview: always right screen
        engine.setValue("[Skin]", "hide_deck_a", 1);
        engine.setValue("[Skin]", "hide_deck_b", 1);
    } else {
        // Other panels: replace non-active deck
        engine.setValue("[Skin]", "hide_deck_a", (anyPanel && MaschineMK3.activeDeck === 2) ? 1 : 0);
        engine.setValue("[Skin]", "hide_deck_b", (anyPanel && MaschineMK3.activeDeck === 1) ? 1 : 0);
    }

    MaschineMK3.setLed("browserPlugin", showLib ? 63 : 16);
    MaschineMK3.setLed("mixer", (showMix || showStemMix) ? 63 : 16);

    if (showLib) {
        // focused_widget: 0=none, 1=search bar, 2=sidebar, 3=track table
        engine.setValue("[Library]", "focused_widget", 1);
        MaschineMK3.updateLibraryTabLEDs();
    } else {
        // Restore D1-D4 LEDs to normal state
        MaschineMK3.setLed("d1", 0);
        MaschineMK3.setLed("d2", 0);
        MaschineMK3.setLed("d3", 0);
        MaschineMK3.setLed("d4", 0);
    }
};
```

- [ ] **Step 3: Close stem mixer in other panel-opening code paths**

In `onButtonPress`, add `MaschineMK3.stemMixerVisible = false;` alongside the existing `mixerVisible = false` lines:

Line ~803 (notes button):
```javascript
        if (MaschineMK3.cueDisplayVisible) {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.mixerVisible = false;
            MaschineMK3.stemMixerVisible = false;
        }
```

Line ~821 (performFxSelect):
```javascript
        if (MaschineMK3.padMode !== "cuepoints") {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.mixerVisible = false;
            MaschineMK3.stemMixerVisible = false;
            MaschineMK3.cueDisplayVisible = false;
        }
```

Line ~882 (browserPlugin):
```javascript
        if (MaschineMK3.libraryVisible) {
            MaschineMK3.mixerVisible = false;
            MaschineMK3.stemMixerVisible = false;
```

- [ ] **Step 4: Update updateDeckLEDs to include stem mixer**

In `updateDeckLEDs` (line 404), add `stemMixerVisible` to the panel check:

```javascript
    if (MaschineMK3.libraryVisible || MaschineMK3.mixerVisible || MaschineMK3.stemMixerVisible) {
        MaschineMK3.updatePanels();
    }
```

- [ ] **Step 5: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(stems): add shift+mixer toggle for stem mixer panel

Shift+mixer toggles stem mixer visibility, mutually exclusive with
library and EQ mixer. updatePanels handles show_stem_mixer config key."
```

---

### Task 4: Add stem knob control (volume + shift=pan)

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:1039-1067` (getKnobBinding)
- Modify: `mapping/Native-Instruments-Maschine-MK3.js:1139-1202` (onKnobChange)

- [ ] **Step 1: Add stem mixer knob bindings to getKnobBinding**

Add a stem mixer check before the existing mixer check in `getKnobBinding` (before line 1040):

```javascript
MaschineMK3.getKnobBinding = function(knobName) {
    if (MaschineMK3.stemMixerVisible) {
        // Stem mixer: opposite-side knobs control active deck's stems
        // Active deck 1 → stems on K5-K8; Active deck 2 → stems on K1-K4
        var stemKnobs = MaschineMK3.activeDeck === 1
            ? {k5: 1, k6: 2, k7: 3, k8: 4}
            : {k1: 1, k2: 2, k3: 3, k4: 4};
        var stemNum = stemKnobs[knobName];
        if (stemNum) {
            var stemGroup = "[Channel" + MaschineMK3.activeDeck + "Stem" + stemNum + "]";
            if (MaschineMK3.shiftPressed) {
                return {group: stemGroup, key: "pan"};
            }
            return {group: stemGroup, key: "volume"};
        }
    }
    if (MaschineMK3.mixerVisible) {
```

(The rest of `getKnobBinding` stays the same.)

- [ ] **Step 2: Add stem knob handling in onKnobChange**

Add a new block before the `if (MaschineMK3.mixerVisible)` check in `onKnobChange` (before line 1139):

```javascript
    if (MaschineMK3.stemMixerVisible) {
        // Stem mixer mode: opposite-side knobs control active deck's stems
        var stemKnobs = MaschineMK3.activeDeck === 1
            ? {k5: 1, k6: 2, k7: 3, k8: 4}
            : {k1: 1, k2: 2, k3: 3, k4: 4};
        var stemNum = stemKnobs[name];
        if (stemNum) {
            var stemGroup = "[Channel" + MaschineMK3.activeDeck + "Stem" + stemNum + "]";
            if (MaschineMK3.shiftPressed) {
                // Shift held: control pan (0.0 = left, 0.5 = center, 1.0 = right)
                MaschineMK3.adjustValue(stemGroup, "pan", delta, 0.005, 0, 1);
            } else {
                // Normal: control volume (0.0 - 1.0)
                MaschineMK3.adjustValue(stemGroup, "volume", delta, 0.005, 0, 1);
            }
            return;
        }
        // Non-stem knobs fall through to normal mode
    } else if (MaschineMK3.mixerVisible) {
```

Change the existing `if (MaschineMK3.mixerVisible)` to `else if` (it becomes part of the chain above).

- [ ] **Step 3: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(stems): add stem volume/pan knob control

Opposite-side knobs control stem volume when stem mixer is visible.
Shift+knob controls stem pan. Values clamped to 0-1, no wrap-around."
```

---

### Task 5: Add skin config attribute and StemMixerPanel to skin.xml

**Files:**
- Modify: `skin/MK3/skin.xml:9-22` (config attributes)
- Modify: `skin/MK3/skin.xml` (add StemMixerPanel after MixerPanel, ~line 750)

- [ ] **Step 1: Add show_stem_mixer config attribute**

Add after the `show_mixer` attribute (after line 17):

```xml
      <attribute config_key="[Skin],show_stem_mixer">0</attribute>
```

- [ ] **Step 2: Add StemMixerPanel widget group**

Add after the closing `</WidgetGroup>` of MixerPanel (after the Deck B mixer section ends). The panel shows 4 stem channels for the active deck:

```xml
    <!-- ═══════ STEM MIXER PANEL (480x272) ═══════ -->
    <WidgetGroup>
      <ObjectName>StemMixerPanel</ObjectName>
      <Size>480,272</Size>
      <SizePolicy>f,f</SizePolicy>
      <Layout>vertical</Layout>
      <Connection>
        <ConfigKey>[Skin],show_stem_mixer</ConfigKey>
        <BindProperty>visible</BindProperty>
      </Connection>
      <Children>

        <!-- Header: STEMS — Deck A (visible when deck A is active) -->
        <WidgetGroup>
          <Connection><ConfigKey>[Skin],active_deck_a</ConfigKey><BindProperty>visible</BindProperty></Connection>
          <Size>480f,24f</Size>
          <Children>
            <Label><ObjectName>StemHeader</ObjectName><Size>480f,24f</Size><Text>STEMS — Deck A</Text></Label>
          </Children>
        </WidgetGroup>
        <!-- Header: STEMS — Deck B (visible when deck B is active) -->
        <WidgetGroup>
          <Connection><ConfigKey>[Skin],active_deck_b</ConfigKey><BindProperty>visible</BindProperty></Connection>
          <Size>480f,24f</Size>
          <Children>
            <Label><ObjectName>StemHeader</ObjectName><Size>480f,24f</Size><Text>STEMS — Deck B</Text></Label>
          </Children>
        </WidgetGroup>

        <!-- Stem channels -->
        <WidgetGroup>
          <ObjectName>StemContent</ObjectName>
          <SizePolicy>me,me</SizePolicy>
          <Layout>horizontal</Layout>
          <Children>

            <!-- Deck A stems (visible when deck A is active) -->
            <WidgetGroup>
              <SizePolicy>me,me</SizePolicy>
              <Layout>horizontal</Layout>
              <Connection><ConfigKey>[Skin],active_deck_a</ConfigKey><BindProperty>visible</BindProperty></Connection>
              <Children>

                <!-- Stem 1: Drums -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Drums</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck1.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel1Stem1],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel1Stem1],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

                <!-- Stem 2: Bass -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Bass</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck1.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel1Stem2],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel1Stem2],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

                <!-- Stem 3: Other -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Other</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck1.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel1Stem3],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel1Stem3],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

                <!-- Stem 4: Vox -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Vox</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck1.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel1Stem4],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel1Stem4],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

              </Children>
            </WidgetGroup>

            <!-- Deck B stems (visible when deck B is active) -->
            <WidgetGroup>
              <SizePolicy>me,me</SizePolicy>
              <Layout>horizontal</Layout>
              <Connection><ConfigKey>[Skin],active_deck_b</ConfigKey><BindProperty>visible</BindProperty></Connection>
              <Children>

                <!-- Stem 1: Drums -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Drums</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck2.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel2Stem1],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel2Stem1],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

                <!-- Stem 2: Bass -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Bass</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck2.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel2Stem2],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel2Stem2],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

                <!-- Stem 3: Other -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Other</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck2.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel2Stem3],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel2Stem3],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

                <!-- Stem 4: Vox -->
                <WidgetGroup>
                  <ObjectName>StemChannel</ObjectName>
                  <Layout>vertical</Layout>
                  <SizePolicy>me,me</SizePolicy>
                  <Children>
                    <Label><ObjectName>StemLabel</ObjectName><Size>0me,16f</Size><Text>Vox</Text></Label>
                    <SliderComposed>
                      <SizePolicy>f,me</SizePolicy>
                      <Size>40,0</Size>
                      <Slider scalemode="STRETCH">slider-vertical.svg</Slider>
                      <Handle scalemode="STRETCH_ASPECT">handle-volume-deck2.svg</Handle>
                      <Horizontal>false</Horizontal>
                      <Connection>
                        <ConfigKey>[Channel2Stem4],volume</ConfigKey>
                        <EmitOnDownPress>false</EmitOnDownPress>
                      </Connection>
                    </SliderComposed>
                    <PushButton>
                      <ObjectName>StemMuteButton</ObjectName>
                      <Size>40f,20f</Size>
                      <NumberStates>2</NumberStates>
                      <State><Number>0</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_unmuted.svg</Pressed>
                      </State>
                      <State><Number>1</Number>
                        <Unpressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Unpressed>
                        <Pressed scalemode="STRETCH_ASPECT">btn_stem_muted.svg</Pressed>
                      </State>
                      <Connection><ConfigKey>[Channel2Stem4],mute</ConfigKey><ButtonState>LeftButton</ButtonState></Connection>
                    </PushButton>
                  </Children>
                </WidgetGroup>

              </Children>
            </WidgetGroup>

          </Children>
        </WidgetGroup>

      </Children>
    </WidgetGroup>
```

- [ ] **Step 3: Commit**

```bash
git add skin/MK3/skin.xml
git commit -m "feat(skin): add StemMixerPanel with 4 stem channels per deck

480x272 panel with volume faders and mute buttons for 4 stems.
Shows active deck only, controlled by show_stem_mixer config key."
```

---

### Task 6: Add stem mute button SVGs and skin styles

**Files:**
- Create: `skin/MK3/btn_stem_unmuted.svg`
- Create: `skin/MK3/btn_stem_muted.svg`
- Modify: `skin/MK3/style.qss`

- [ ] **Step 1: Create btn_stem_unmuted.svg**

A small green filled rectangle (unmuted indicator):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20">
  <rect x="4" y="4" width="32" height="12" rx="2" fill="#4CAF50"/>
</svg>
```

- [ ] **Step 2: Create btn_stem_muted.svg**

A small grey outlined rectangle (muted indicator):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20">
  <rect x="4" y="4" width="32" height="12" rx="2" fill="none" stroke="#666" stroke-width="1"/>
</svg>
```

- [ ] **Step 3: Add stem styles to style.qss**

Read `style.qss` first, then append stem mixer styles:

```css
/* Stem Mixer Panel */
#StemMixerPanel {
  background-color: #0d0d1a;
}
#StemHeader {
  color: #e67e22;
  font: bold 11px sans-serif;
  padding-left: 10px;
  background-color: #1a1a2e;
}
#StemContent {
  margin: 4px;
}
#StemChannel {
  margin: 0 8px;
  background-color: #1a1a2e;
  border-radius: 4px;
  padding: 4px;
}
#StemLabel {
  color: #ccc;
  font: bold 10px sans-serif;
  qproperty-alignment: AlignCenter;
}
#StemMuteButton {
  margin-top: 4px;
}
```

- [ ] **Step 4: Commit**

```bash
git add skin/MK3/btn_stem_unmuted.svg skin/MK3/btn_stem_muted.svg skin/MK3/style.qss
git commit -m "feat(skin): add stem mute button SVGs and stem mixer styles"
```

---

### Task 7: Add knob label switching for stem mixer mode

**Files:**
- Modify: `skin/MK3/skin.xml` (knob label section, ~lines 226-310)

The knob labels need to show stem names when stem mixer is visible. This follows the same pattern as the existing mixer/normal/shift label switching.

- [ ] **Step 1: Add stem mixer knob labels for Deck A active (K5-K8 are stem knobs)**

In the Deck B knob label area (right screen, K5-K8), add a stem mixer variant. Find the existing knob label section for the right screen and add a nested group that shows stem labels when `show_stem_mixer` is active:

For the right-screen knob labels, add alongside existing mixer/normal variants:

```xml
            <!-- Stem mixer mode (active deck A → right screen) -->
            <WidgetGroup>
              <SizePolicy>me,f</SizePolicy><Layout>horizontal</Layout>
              <Connection><ConfigKey>[Skin],show_stem_mixer</ConfigKey><BindProperty>visible</BindProperty></Connection>
              <Children>
                <!-- Shift: show PAN labels -->
                <WidgetGroup>
                  <SizePolicy>me,f</SizePolicy><Layout>horizontal</Layout>
                  <Connection><ConfigKey>[Skin],shift_held</ConfigKey><BindProperty>visible</BindProperty></Connection>
                  <Children>
                    <Label><ObjectName>KnobLabelShift</ObjectName><Size>120,12</Size><Text>PAN:DRM</Text></Label>
                    <Label><ObjectName>KnobLabelShift</ObjectName><Size>120,12</Size><Text>PAN:BAS</Text></Label>
                    <Label><ObjectName>KnobLabelShift</ObjectName><Size>120,12</Size><Text>PAN:OTH</Text></Label>
                    <Label><ObjectName>KnobLabelShift</ObjectName><Size>120,12</Size><Text>PAN:VOX</Text></Label>
                  </Children>
                </WidgetGroup>
                <!-- No shift: show VOL labels -->
                <WidgetGroup>
                  <SizePolicy>me,f</SizePolicy><Layout>horizontal</Layout>
                  <Connection><ConfigKey>[Skin],shift_held</ConfigKey><BindProperty>visible</BindProperty><Transform><Not/></Transform></Connection>
                  <Children>
                    <Label><ObjectName>KnobLabel</ObjectName><Size>120,12</Size><Text>DRUMS</Text></Label>
                    <Label><ObjectName>KnobLabel</ObjectName><Size>120,12</Size><Text>BASS</Text></Label>
                    <Label><ObjectName>KnobLabel</ObjectName><Size>120,12</Size><Text>OTHER</Text></Label>
                    <Label><ObjectName>KnobLabel</ObjectName><Size>120,12</Size><Text>VOX</Text></Label>
                  </Children>
                </WidgetGroup>
              </Children>
            </WidgetGroup>
```

The exact insertion point depends on how the existing label nesting works — the labels must be `<Not/>` visible when stem mixer is NOT active, alongside the existing mixer/normal labels.

- [ ] **Step 2: Commit**

```bash
git add skin/MK3/skin.xml
git commit -m "feat(skin): add stem mixer knob labels (DRUMS/BASS/OTHER/VOX and PAN)"
```
