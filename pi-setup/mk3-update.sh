#!/bin/bash
set -euo pipefail

# Quick update script — pulls latest from git and applies changes.
# Run from anywhere on the Pi: bash /path/to/mk3-update.sh
# Or if the repo is cloned: cd ~/mixx-mk3 && bash pi-setup/mk3-update.sh

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
    exit 0
fi

echo ""
echo "Changes:"
git log --oneline "$BEFORE".."$AFTER"
echo ""

# ── Mapping ──────────────────────────────────────────────────────────
mkdir -p "$PI_HOME/.mixxx/controllers"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.hid.xml" "$PI_HOME/.mixxx/controllers/"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.js" "$PI_HOME/.mixxx/controllers/"
echo "  Mapping updated"

# ── Skin ─────────────────────────────────────────────────────────────
sudo mkdir -p /usr/share/mixxx/skins/MK3
sudo cp "$PROJECT_DIR/skin/MK3/skin.xml" /usr/share/mixxx/skins/MK3/
sudo cp "$PROJECT_DIR/skin/MK3/style.qss" /usr/share/mixxx/skins/MK3/
echo "  Skin updated"

# ── Services ─────────────────────────────────────────────────────────
for svc in pipewire.service wireplumber.service mk3-screen-daemon.service openbox.service xvfb.service; do
    if [ -f "$SCRIPT_DIR/$svc" ]; then
        sed -e "s/User=pi/User=$PI_USER/" \
            -e "s|/run/user/1000|/run/user/$UID_NUM|" \
            -e "s/pi:pi/$PI_USER:$PI_USER/" \
            "$SCRIPT_DIR/$svc" | sudo tee /etc/systemd/system/$svc > /dev/null
    fi
done
if [ -f "$SCRIPT_DIR/mixxx.service" ]; then
    sed -e "s/User=pi/User=$PI_USER/" \
        -e "s|HOME=/home/pi|HOME=$PI_HOME|" \
        -e "s|/run/user/1000|/run/user/$UID_NUM|" \
        "$SCRIPT_DIR/mixxx.service" | sudo tee /etc/systemd/system/mixxx.service > /dev/null
fi
echo "  Services updated"

# ── Rebuild screen daemon if source changed ──────────────────────────
if git diff --name-only "$BEFORE".."$AFTER" | grep -qE "^screen-daemon/|^external/mk3/"; then
    echo "  Screen daemon source changed — rebuilding..."
    cd "$PROJECT_DIR"
    rm -rf build && mkdir build && cd build
    cmake .. -DCAPTURE_BACKEND=x11
    cmake --build . --target mk3-screen-daemon -j"$(nproc)"
    sudo install -m 755 screen-daemon/mk3-screen-daemon /usr/local/bin/mk3-screen-daemon
    echo "  Screen daemon rebuilt and installed"
fi

# ── Apply ────────────────────────────────────────────────────────────
chown -R "$PI_USER:$PI_USER" "$PI_HOME/.mixxx"
sudo systemctl daemon-reload
sudo systemctl restart mixxx
echo ""
echo "Update complete. Mixxx restarted."
