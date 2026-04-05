#!/bin/bash
# Mirror Mixxx headphone output (JACK ports out_2/out_3) to Pi built-in audio.
# Runs as a systemd service alongside Mixxx. Retries until ports appear.

set -uo pipefail

PI_SINK_L=""
PI_SINK_R=""
MIXXX_HP_L="Mixxx:out_2"
MIXXX_HP_R="Mixxx:out_3"

find_pi_sink() {
    # Find Pi built-in audio sink ports (not the MK3)
    PI_SINK_L=$(pw-link -i 2>/dev/null | grep -v 'Maschine\|Midi' | grep 'playback_FL' | head -1)
    PI_SINK_R=$(pw-link -i 2>/dev/null | grep -v 'Maschine\|Midi' | grep 'playback_FR' | head -1)
}

echo "mk3-headphone-mirror: waiting for Mixxx headphone ports..."

while true; do
    # Check if Mixxx headphone ports exist
    if pw-link -o 2>/dev/null | grep -q "$MIXXX_HP_L"; then
        find_pi_sink
        if [ -n "$PI_SINK_L" ] && [ -n "$PI_SINK_R" ]; then
            pw-link "$MIXXX_HP_L" "$PI_SINK_L" 2>/dev/null
            pw-link "$MIXXX_HP_R" "$PI_SINK_R" 2>/dev/null
            echo "mk3-headphone-mirror: linked $MIXXX_HP_L -> $PI_SINK_L"
            echo "mk3-headphone-mirror: linked $MIXXX_HP_R -> $PI_SINK_R"
            break
        fi
    fi
    sleep 2
done

# Keep running and re-link if connection drops (e.g., Mixxx restarts)
while true; do
    sleep 10
    # Check if links still exist
    if ! pw-link -l 2>/dev/null | grep -A1 "$MIXXX_HP_L" | grep -q "$PI_SINK_L"; then
        if pw-link -o 2>/dev/null | grep -q "$MIXXX_HP_L"; then
            find_pi_sink
            if [ -n "$PI_SINK_L" ] && [ -n "$PI_SINK_R" ]; then
                pw-link "$MIXXX_HP_L" "$PI_SINK_L" 2>/dev/null
                pw-link "$MIXXX_HP_R" "$PI_SINK_R" 2>/dev/null
                echo "mk3-headphone-mirror: re-linked"
            fi
        fi
    fi
done
