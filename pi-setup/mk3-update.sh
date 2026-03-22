#!/bin/bash
set -euo pipefail

# Quick update script — copies mapping, skin, and config without rebuilding.
# Usage: sudo bash pi-setup/mk3-update.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PI_USER="${SUDO_USER:-$(whoami)}"
PI_HOME=$(eval echo "~$PI_USER")

echo "=== MK3 Quick Update ==="

# Mapping
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.hid.xml" "$PI_HOME/.mixxx/controllers/"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.js" "$PI_HOME/.mixxx/controllers/"
echo "  Mapping updated"

# Skin
sudo cp "$PROJECT_DIR/skin/MK3/skin.xml" /usr/share/mixxx/skins/MK3/
sudo cp "$PROJECT_DIR/skin/MK3/style.qss" /usr/share/mixxx/skins/MK3/
echo "  Skin updated"

# Services (only if changed)
for svc in pipewire.service wireplumber.service; do
    if [ -f "$SCRIPT_DIR/$svc" ]; then
        UID_NUM=$(id -u "$PI_USER")
        sed -e "s/User=pi/User=$PI_USER/" \
            -e "s|/run/user/1000|/run/user/$UID_NUM|" \
            -e "s/pi:pi/$PI_USER:$PI_USER/" \
            "$SCRIPT_DIR/$svc" | sudo tee /etc/systemd/system/$svc > /dev/null
    fi
done
if [ -f "$SCRIPT_DIR/mixxx.service" ]; then
    UID_NUM=$(id -u "$PI_USER")
    sed -e "s/User=pi/User=$PI_USER/" \
        -e "s|HOME=/home/pi|HOME=$PI_HOME|" \
        -e "s|/run/user/1000|/run/user/$UID_NUM|" \
        "$SCRIPT_DIR/mixxx.service" | sudo tee /etc/systemd/system/mixxx.service > /dev/null
fi

sudo systemctl daemon-reload
chown -R "$PI_USER:$PI_USER" "$PI_HOME/.mixxx"

# Restart Mixxx
sudo systemctl restart mixxx
echo "  Mixxx restarted"
echo "Done."
