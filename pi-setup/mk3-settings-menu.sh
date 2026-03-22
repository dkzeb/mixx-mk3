#!/bin/bash
# MK3 Settings menu — shown on the MK3 screens via Xvfb.
# Navigate with MK3 nav encoder, select with navPush.
# Called from the Mixxx JS mapping via system().

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DISPLAY="${DISPLAY:-:99}"
export DISPLAY

# Start button reader for nav encoder → keyboard mapping
python3 "$SCRIPT_DIR/mk3-button-reader.py" &
READER_PID=$!

cleanup() {
    kill $READER_PID 2>/dev/null
    wait $READER_PID 2>/dev/null
}
trap cleanup EXIT

CHOICE=$(zenity --list \
    --title="MK3 Settings" \
    --text="Navigate with encoder, press to select" \
    --column="Action" \
    --width=400 --height=250 \
    --timeout=30 \
    "Reboot" \
    "Shutdown" \
    "Check for Updates" \
    "Cancel" \
    2>/dev/null)

case "$CHOICE" in
    Reboot)
        zenity --info --text="Rebooting..." --timeout=3 --no-wrap --width=300 2>/dev/null
        sudo reboot
        ;;
    Shutdown)
        zenity --info --text="Shutting down..." --timeout=3 --no-wrap --width=300 2>/dev/null
        sudo shutdown -h now
        ;;
    "Check for Updates")
        bash "$SCRIPT_DIR/mk3-check-update.sh"
        ;;
    *)
        # Cancel or timeout
        ;;
esac
