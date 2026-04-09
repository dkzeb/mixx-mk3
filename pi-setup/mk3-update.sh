#!/bin/bash
set -euo pipefail

# Quick update script — pulls latest from git and applies changes.
# Run from anywhere on the Pi: bash /path/to/mk3-update.sh
# Or if the repo is cloned: cd ~/mixxx-mk3 && bash pi-setup/mk3-update.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PI_USER="${SUDO_USER:-$(whoami)}"
PI_HOME=$(eval echo "~$PI_USER")
UID_NUM=$(id -u "$PI_USER")

echo "=== MK3 Update ==="

# ── Pull latest ──────────────────────────────────────────────────────
cd "$PROJECT_DIR"
BEFORE=$(git rev-parse HEAD)
sudo -u "$PI_USER" git pull --ff-only origin master 2>&1 | tail -3
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    echo "Already up to date."
else
    echo ""
    echo "Changes:"
    git log --oneline "$BEFORE".."$AFTER"
    echo ""
fi

# ── Mapping ──────────────────────────────────────────────────────────
mkdir -p "$PI_HOME/.mixxx/controllers"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.hid.xml" "$PI_HOME/.mixxx/controllers/"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.js" "$PI_HOME/.mixxx/controllers/"
echo "  Mapping updated"

# ── Skin ─────────────────────────────────────────────────────────────
# Install skin to both system paths (Mixxx may use either depending on install method)
for SKIN_DIR in /usr/share/mixxx/skins/MK3 /usr/local/share/mixxx/skins/MK3; do
    sudo mkdir -p "$SKIN_DIR"
    sudo cp -r "$PROJECT_DIR/skin/MK3/"* "$SKIN_DIR/"
done
# Remove user skin override (Mixxx loads from ~/.mixxx/skins/ first, but without
# all assets the skin:* paths break — let Mixxx use the system skin dir instead)
rm -rf "$PI_HOME/.mixxx/skins/MK3"
echo "  Skin updated"

# ── Services ─────────────────────────────────────────────────────────
# PipeWire runs as user-level service (from the pipewire package)
sudo systemctl disable pipewire.service wireplumber.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/pipewire.service /etc/systemd/system/wireplumber.service
sudo loginctl enable-linger "$PI_USER"

for svc in mk3-screen-daemon.service openbox.service xvfb.service; do
    if [ -f "$SCRIPT_DIR/$svc" ]; then
        sed -e "s/User=pi/User=$PI_USER/" \
            -e "s|/run/user/1000|/run/user/$UID_NUM|" \
            -e "s/pi:pi/$PI_USER:$PI_USER/" \
            "$SCRIPT_DIR/$svc" | sudo tee /etc/systemd/system/$svc > /dev/null
    fi
done
for svc in mixxx.service mk3-t9-daemon.service mk3-mouse-daemon.service mk3-overlay.service mk3-headphone-mirror.service; do
    if [ -f "$SCRIPT_DIR/$svc" ]; then
        sed -e "s/User=pi/User=$PI_USER/" \
            -e "s|HOME=/home/pi|HOME=$PI_HOME|" \
            -e "s|/home/pi/mixxx-mk3|$PI_HOME/mixxx-mk3|" \
            -e "s|/run/user/1000|/run/user/$UID_NUM|" \
            "$SCRIPT_DIR/$svc" | sudo tee /etc/systemd/system/$svc > /dev/null
    fi
done
# Boot splash (only needs path patching)
if [ -f "$SCRIPT_DIR/mk3-bootsplash.service" ]; then
    sed -e "s|/home/pi/mixxx-mk3|$PI_HOME/mixxx-mk3|" \
        "$SCRIPT_DIR/mk3-bootsplash.service" | sudo tee /etc/systemd/system/mk3-bootsplash.service > /dev/null
    sudo systemctl enable mk3-bootsplash.service 2>/dev/null || true
fi
echo "  Services updated"

# ── Rebuild screen daemon if source changed ──────────────────────────
if git diff --name-only "$BEFORE".."$AFTER" | grep -qE "^screen-daemon/|^external/mk3/|^external/mpi-tools/mk3_cli/"; then
    echo "  Screen daemon or mk3 CLI source changed — rebuilding..."
    cd "$PROJECT_DIR"
    rm -rf build && mkdir build && cd build
    cmake .. -DCAPTURE_BACKEND=x11
    cmake --build . --target mk3-screen-daemon mk3_cli -j"$(nproc)"
    sudo install -m 755 screen-daemon/mk3-screen-daemon /usr/local/bin/mk3-screen-daemon
    sudo install -m 755 external/mpi-tools/mk3_cli/mk3_cli /usr/local/bin/mk3
    echo "  Screen daemon and mk3 CLI rebuilt and installed"
fi

# ── Pre-extract bootsplash frames ────────────────────────────────────
SPLASH_GIF="$SCRIPT_DIR/bootsplash-left-anim.gif"
SPLASH_PNG="$SCRIPT_DIR/bootsplash-left.png"
SPLASH_DIR="/var/lib/mk3-bootsplash"
sudo mkdir -p "$SPLASH_DIR"
if [ -f "$SPLASH_GIF" ]; then
    sudo rm -f "$SPLASH_DIR"/frame_*.raw
    ffmpeg -v quiet -i "$SPLASH_GIF" -pix_fmt rgb565le -s 480x272 \
        -f rawvideo "$SPLASH_DIR/all_frames.raw" 2>/dev/null || true
    FRAME_BYTES=$((480 * 272 * 2))
    if [ -f "$SPLASH_DIR/all_frames.raw" ]; then
        FILE_SIZE=$(stat -c%s "$SPLASH_DIR/all_frames.raw")
        NFRAMES=$((FILE_SIZE / FRAME_BYTES))
        for ((i = 0; i < NFRAMES; i++)); do
            sudo dd if="$SPLASH_DIR/all_frames.raw" of="$SPLASH_DIR/frame_${i}.raw" \
                bs=$FRAME_BYTES skip=$i count=1 2>/dev/null
        done
        sudo rm -f "$SPLASH_DIR/all_frames.raw"
        echo "  Bootsplash: $NFRAMES frames extracted"
    fi
elif [ -f "$SPLASH_PNG" ]; then
    sudo rm -f "$SPLASH_DIR"/frame_*.raw
    ffmpeg -v quiet -i "$SPLASH_PNG" -pix_fmt rgb565le -s 480x272 \
        -f rawvideo "$SPLASH_DIR/frame_0.raw" 2>/dev/null || true
    echo "  Bootsplash: static PNG extracted"
fi

# ── Apply ────────────────────────────────────────────────────────────
chown -R "$PI_USER:$PI_USER" "$PI_HOME/.mixxx"
sudo systemctl daemon-reload
if [ "${1:-}" != "--no-restart" ]; then
    sudo systemctl restart mixxx
fi
echo ""
echo "Update complete. Mixxx restarted."
