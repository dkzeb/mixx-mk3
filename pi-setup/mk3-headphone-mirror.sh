#!/bin/bash
# Route Mixxx headphone output to Pi built-in audio (3.5mm jack) instead of MK3.
#
# The MK3 hardware mixes all 4 output channels into its headphone jack,
# making PFL isolation impossible when master also goes to the MK3.
# Solution: disconnect headphones from MK3, route to Pi 3.5mm only.
#
# Master (out_0/out_1) stays on MK3 main outputs (1/4" jacks).
# Headphones (out_2/out_3) go to Pi built-in audio (3.5mm jack).

set -uo pipefail

MIXXX_HP_L="Mixxx:out_2"
MIXXX_HP_R="Mixxx:out_3"
MK3_SINK="alsa_output.usb-Native_Instruments_Maschine_MK3"

find_pi_sink() {
    PI_SINK_L=$(pw-link -i 2>/dev/null | grep -v 'Maschine\|Midi' | grep 'playback_FL' | head -1)
    PI_SINK_R=$(pw-link -i 2>/dev/null | grep -v 'Maschine\|Midi' | grep 'playback_FR' | head -1)
}

echo "mk3-headphone-mirror: waiting for Mixxx headphone ports..."

while true; do
    if pw-link -o 2>/dev/null | grep -q "$MIXXX_HP_L"; then
        find_pi_sink
        if [ -n "$PI_SINK_L" ] && [ -n "$PI_SINK_R" ]; then
            # Disconnect headphones from MK3 (prevents hardware mixing)
            for mk3_port in $(pw-link -i 2>/dev/null | grep "$MK3_SINK" | grep 'playback_RL\|playback_RR'); do
                pw-link -d "$MIXXX_HP_L" "$mk3_port" 2>/dev/null
                pw-link -d "$MIXXX_HP_R" "$mk3_port" 2>/dev/null
            done
            echo "mk3-headphone-mirror: disconnected headphones from MK3"

            # Connect headphones to Pi built-in audio
            pw-link "$MIXXX_HP_L" "$PI_SINK_L" 2>/dev/null
            pw-link "$MIXXX_HP_R" "$PI_SINK_R" 2>/dev/null
            echo "mk3-headphone-mirror: linked $MIXXX_HP_L -> $PI_SINK_L"
            echo "mk3-headphone-mirror: linked $MIXXX_HP_R -> $PI_SINK_R"
            break
        fi
    fi
    sleep 2
done

# Keep running — re-link if connection drops and prevent MK3 re-linking
while true; do
    sleep 10
    if pw-link -o 2>/dev/null | grep -q "$MIXXX_HP_L"; then
        find_pi_sink
        if [ -n "$PI_SINK_L" ] && [ -n "$PI_SINK_R" ]; then
            # Ensure headphones are NOT linked to MK3
            for mk3_port in $(pw-link -i 2>/dev/null | grep "$MK3_SINK" | grep 'playback_RL\|playback_RR'); do
                pw-link -d "$MIXXX_HP_L" "$mk3_port" 2>/dev/null
                pw-link -d "$MIXXX_HP_R" "$mk3_port" 2>/dev/null
            done

            # Ensure headphones ARE linked to Pi
            pw-link "$MIXXX_HP_L" "$PI_SINK_L" 2>/dev/null
            pw-link "$MIXXX_HP_R" "$PI_SINK_R" 2>/dev/null
        fi
    fi
done
