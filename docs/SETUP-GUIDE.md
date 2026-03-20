# MK3 Mixxx Standalone DJ Unit — Setup Guide

Turn a Raspberry Pi 4 + Maschine MK3 into a headless standalone DJ unit with Mixxx.

The MK3 screens show the full boot process and then transition to the Mixxx UI.

---

## What You Need

- Raspberry Pi 4 (2GB+ RAM)
- microSD card (16GB+, Class 10 or better)
- NI Maschine MK3 + USB cable
- Audio output: USB audio interface, Pi headphone jack, or HDMI audio
- Another computer to flash the SD card and SSH into the Pi
- Ethernet cable or WiFi credentials for initial setup

---

## Step 1: Flash Raspberry Pi OS Lite

On your computer:

1. Download **Raspberry Pi Imager** from https://www.raspberrypi.com/software/
2. Open it and choose:
   - **OS:** Raspberry Pi OS (other) → **Raspberry Pi OS Lite (64-bit)**
   - **Storage:** your microSD card
3. Click the **gear icon** (⚙) before writing to pre-configure:
   - **Enable SSH** (use password authentication)
   - **Set username/password** (e.g., `pi` / your-password)
   - **Configure WiFi** (if not using Ethernet)
   - **Set locale/timezone**
4. Click **Write** and wait for it to finish.

Insert the SD card into the Pi. **Do not plug in the MK3 yet.**

---

## Step 2: First Boot and SSH In

1. Power on the Pi with Ethernet connected (or WiFi if configured).
2. Wait ~60 seconds for first boot.
3. Find the Pi's IP address:
   - Check your router's DHCP client list, or
   - From another machine: `ping raspberrypi.local`
4. SSH in:

```bash
ssh pi@raspberrypi.local
# Enter your password
```

---

## Step 3: Update the System

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

This may take a few minutes. Reboot after:

```bash
sudo reboot
```

SSH back in after it comes back up.

---

## Step 4: Clone the Project

```bash
sudo apt-get install -y git
git clone https://github.com/YOUR-USERNAME/mixx-mk3.git
cd mixx-mk3
```

(Replace the URL with wherever you host this repo, or copy it via `scp`.)

---

## Step 5: Plug In the MK3

Connect the Maschine MK3 to the Pi via USB. Verify it's detected:

```bash
lsusb | grep 17cc
```

Expected output:
```
Bus 001 Device 00X: ID 17cc:1600 Native Instruments Maschine MK3
```

If you don't see it, try a different USB port. The MK3 needs USB 2.0+.

---

## Step 6: Run the Setup Script

```bash
cd ~/mixx-mk3
sudo ./pi-setup/mk3-pi-setup.sh
```

This will:
1. Install Mixxx and build dependencies
2. Build the screen mirroring daemon
3. Install the MK3 HID controller mapping
4. Set up udev rules (USB permissions)
5. Install systemd services (auto-start on boot)
6. Configure the framebuffer for headless 960x544 output
7. Set up `fbcon` so boot messages appear on the framebuffer

**This takes 5-15 minutes** depending on your internet speed.

---

## Step 7: Reboot

```bash
sudo reboot
```

**Watch the MK3 screens.** Here's what you should see:

1. **~5 seconds after power-on:** MK3 screens light up with a dark blue splash (screen daemon found the device)
2. **~10 seconds:** Linux boot messages scroll across both MK3 screens (kernel, systemd startup)
3. **~30-60 seconds:** Mixxx UI appears on the MK3 screens (left screen = left half, right screen = right half)
4. **MK3 controls become active** once Mixxx detects the HID device and loads the mapping

---

## Step 8: Verify Everything Works

SSH back in and check the services:

```bash
# Screen daemon should be running
systemctl status mk3-screen-daemon

# Mixxx should be running
systemctl status mixxx
```

Both should show `active (running)`.

### Test the controls

- **Press Play** (the MK3 play button) → Deck A should toggle play (if a track is loaded)
- **Turn the stepper wheel** → Should scroll through the Mixxx library
- **Press Nav Push** → Should select/load an item in the library
- **Press G1-G4** → Group LEDs should light up showing the active pad mode

### Load a track and DJ

1. Before first use, you need tracks in Mixxx's library. Either:
   - Copy music files to the Pi: `scp -r ~/Music pi@raspberrypi.local:~/Music/`
   - Use a USB drive with music (Mixxx can scan it)
2. Use the stepper wheel + nav buttons to browse the library on the MK3 screens
3. Press **D1** to load a track to Deck A, **D5** for Deck B
4. Press **Play** for Deck A, **Stop** (remapped as Play B) for Deck B
5. Use **K1-K4** for Deck A EQ (Hi/Mid/Lo/Filter), **K5-K8** for Deck B

---

## Control Reference

### Transport (always active)

| Button | Function |
|--------|----------|
| `play` | Toggle Deck A play |
| `stop` | Toggle Deck B play |
| `recCountIn` | Deck A cue (hold) |
| `tapMetro` | Deck B cue (hold) |
| `restartLoop` | Toggle Deck A sync |
| `eraseReplace` | Toggle Deck B sync |
| `d1` | Load track to Deck A |
| `d5` | Load track to Deck B |

### Navigation (always active)

| Control | Function |
|---------|----------|
| Stepper wheel | Scroll library |
| Nav push | Select item |
| Nav up/down | Move in library |
| Nav left/right | Focus panels |
| `shift` | Modifier (hold) |

### Knobs (always active)

| Knob | Deck A | Deck B |
|------|--------|--------|
| K1 / K5 | EQ High | EQ High |
| K2 / K6 | EQ Mid | EQ Mid |
| K3 / K7 | EQ Low | EQ Low |
| K4 / K8 | Filter | Filter |
| Master Vol | Master gain | — |
| Headphone Vol | Headphone gain | — |

### Pad Modes (G1-G4 select mode)

| Mode | G button | Pads 1-8 (Deck A) | Pads 9-16 (Deck B) |
|------|----------|--------------------|--------------------|
| Hot Cues | G1 | Hotcues 1-8 | Hotcues 1-8 |
| Loops | G2 | Loop sizes | Loop sizes |
| Sampler | G3 | Samplers 1-8 | Samplers 9-16 |
| Effects | G4 | FX params | FX params |

---

## Troubleshooting

### MK3 screens stay black

```bash
# Check if the screen daemon is running
systemctl status mk3-screen-daemon

# Check if the MK3 is detected
lsusb | grep 17cc

# Check daemon logs
journalctl -u mk3-screen-daemon -f
```

Common fixes:
- Try a different USB port (use USB 2.0/3.0 port, not USB-C)
- Replug the MK3
- Check udev rule: `ls -la /dev/bus/usb/` — the MK3 device should be group `audio`

### Mixxx doesn't start or crashes

```bash
journalctl -u mixxx -f
```

Common fixes:
- If Mixxx complains about display: check that `framebuffer_width=960` is in `/boot/firmware/config.txt`
- If Mixxx is out of memory: use a Pi 4 with at least 2GB RAM
- If Mixxx can't find audio: `aplay -l` to list audio devices, configure in `~/.mixxx/mixxx.cfg`

### MK3 controls don't work

```bash
# Check Mixxx logs for controller detection
journalctl -u mixxx | grep -i "maschine\|hid\|controller"
```

The mapping should auto-load when Mixxx detects the MK3. If not:
- Verify mapping files exist: `ls ~/.mixxx/controllers/Native-Instruments*`
- Open Mixxx preferences (if you have a monitor) → Controllers → select MK3 → enable
- Or edit `~/.mixxx/mixxx.cfg` to enable the controller

### Screen looks garbled or offset

The setup assumes a 960x544 framebuffer. Verify:
```bash
fbset -i
# Should show 960x544
```

If the resolution is wrong, check `/boot/firmware/config.txt` has:
```
framebuffer_width=960
framebuffer_height=544
hdmi_force_hotplug:0=1
```

---

## Stopping and Managing Services

```bash
# Stop everything
sudo systemctl stop mixxx mk3-screen-daemon

# Start everything
sudo systemctl start mk3-screen-daemon mixxx

# Disable auto-start
sudo systemctl disable mixxx mk3-screen-daemon

# View live logs
journalctl -u mk3-screen-daemon -u mixxx -f
```

---

## Audio Configuration

By default Mixxx uses the Pi's default audio device. To change it:

1. List available devices: `aplay -l`
2. Edit `~/.mixxx/mixxx.cfg` or use Mixxx's preferences
3. For a USB audio interface, it will appear as a separate ALSA card
4. For low-latency, consider configuring PipeWire:
   ```bash
   sudo apt-get install -y pipewire pipewire-audio-client-libraries
   ```
