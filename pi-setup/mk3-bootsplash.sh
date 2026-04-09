#!/bin/bash
set -euo pipefail

# MK3 Boot Splash
# Left screen:  animated GIF logo (boomerang loop)
# Right screen: live boot log, then "Starting MaschinePi OS..." when Mixxx starts
# Self-terminates to let mk3-screen-daemon take over.

MK3="/usr/local/bin/mk3"
FRAME_DIR="/var/lib/mk3-bootsplash"

trap 'exit 0' SIGTERM SIGINT

# ── Collect pre-extracted frames ──────────────────────────────────────
FRAMES=()
for f in "$FRAME_DIR"/frame_*.raw; do
    [ -f "$f" ] && FRAMES+=("$f")
done

NFRAMES=${#FRAMES[@]}
if [ "$NFRAMES" -eq 0 ]; then
    echo "No splash frames in $FRAME_DIR" >&2
    exit 1
fi

# ── Build boomerang sequence: 0 1 2 ... N-1 N-2 ... 1 ────────────────
SEQ=()
for ((i = 0; i < NFRAMES; i++)); do
    SEQ+=("$i")
done
for ((i = NFRAMES - 2; i >= 1; i--)); do
    SEQ+=("$i")
done
SEQ_LEN=${#SEQ[@]}

# ── Main loop ─────────────────────────────────────────────────────────
frame_idx=0
tick=0
LOG_INTERVAL=5

while true; do
    # Left screen: next animation frame
    cat "${FRAMES[${SEQ[$frame_idx]}]}" | "$MK3" --pipe --target left 2>/dev/null || true
    frame_idx=$(( (frame_idx + 1) % SEQ_LEN ))

    # Right screen: boot log or handoff check (every LOG_INTERVAL frames)
    tick=$(( (tick + 1) % LOG_INTERVAL ))
    if [ "$tick" -eq 0 ]; then
        # When Mixxx is running, show final message and exit
        if systemctl is-active mixxx.service 2>/dev/null | grep -q "^active$"; then
            "$MK3" --text "Starting MaschinePi OS..." --target right --font-size 20 2>/dev/null || true
            sleep 3
            exit 0
        fi

        LINES=$(journalctl -b --no-pager -o cat -n 16 2>/dev/null || echo "Booting...")
        "$MK3" --text "$LINES" --target right --font-size 13 --mono --color 00C880 2>/dev/null || true
    fi
done
