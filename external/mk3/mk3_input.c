#include "mk3_input.h"
#include "mk3_internal.h"
#include "mk3_input_map.h"
#include <libusb.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

// --- Configuration for Pad Processing (from maschine_mk3_config.json input2.packetized_pads) ---
#define PAD_REPORT_ID 0x02
#define PAD_DATA_START_OFFSET 1 // "start": "0x01" in JSON means buffer[1]
#define PAD_MAX_REPEATED_ENTRIES 21 // "repeated": 21
#define PAD_ENTRY_LENGTH 3 // "length": 3
#define PAD_COUNT 16 // "padCount": 16
#define PAD_PRESSURE_PRESS_THRESHOLD 256 // Arbitrary, similar to ni-controllers-lib

// --- Configuration for Buttons (Report ID 0x01) ---
// --- Configuration for Analog Knobs (Report ID 0x01) ---
// Addresses are for the full buffer (buffer[0] = report_id)
#define STEPPER_ADDR 11

#define KNOB_K1_LSB_ADDR 12
#define KNOB_K1_MSB_ADDR 13
#define KNOB_K2_LSB_ADDR 14
#define KNOB_K2_MSB_ADDR 15
#define KNOB_K3_LSB_ADDR 16
#define KNOB_K3_MSB_ADDR 17
#define KNOB_K4_LSB_ADDR 18
#define KNOB_K4_MSB_ADDR 19
#define KNOB_K5_LSB_ADDR 20
#define KNOB_K5_MSB_ADDR 21
#define KNOB_K6_LSB_ADDR 22
#define KNOB_K6_MSB_ADDR 23
#define KNOB_K7_LSB_ADDR 24
#define KNOB_K7_MSB_ADDR 25
#define KNOB_K8_LSB_ADDR 26
#define KNOB_K8_MSB_ADDR 27

#define KNOB_MIC_GAIN_LSB_ADDR 36
#define KNOB_MIC_GAIN_MSB_ADDR 37
#define KNOB_HEADPHONE_VOL_LSB_ADDR 38
#define KNOB_HEADPHONE_VOL_MSB_ADDR 39
#define KNOB_MASTER_VOL_LSB_ADDR 40
#define KNOB_MASTER_VOL_MSB_ADDR 41

typedef struct {
    const char* name;
    int lsb_addr;
    int msb_addr;
} mk3_knob_descriptor_t;

static const mk3_knob_descriptor_t knob_descriptors[] = {
    {"k1", KNOB_K1_LSB_ADDR, KNOB_K1_MSB_ADDR},
    {"k2", KNOB_K2_LSB_ADDR, KNOB_K2_MSB_ADDR},
    {"k3", KNOB_K3_LSB_ADDR, KNOB_K3_MSB_ADDR},
    {"k4", KNOB_K4_LSB_ADDR, KNOB_K4_MSB_ADDR},
    {"k5", KNOB_K5_LSB_ADDR, KNOB_K5_MSB_ADDR},
    {"k6", KNOB_K6_LSB_ADDR, KNOB_K6_MSB_ADDR},
    {"k7", KNOB_K7_LSB_ADDR, KNOB_K7_MSB_ADDR},
    {"k8", KNOB_K8_LSB_ADDR, KNOB_K8_MSB_ADDR},
    {"micInGain", KNOB_MIC_GAIN_LSB_ADDR, KNOB_MIC_GAIN_MSB_ADDR},
    {"headphoneVolume", KNOB_HEADPHONE_VOL_LSB_ADDR, KNOB_HEADPHONE_VOL_MSB_ADDR},
    {"masterVolume", KNOB_MASTER_VOL_LSB_ADDR, KNOB_MASTER_VOL_MSB_ADDR}
};

static size_t knob_descriptor_count(void) {
    return sizeof(knob_descriptors) / sizeof(knob_descriptors[0]);
}

static int16_t compute_knob_delta(uint16_t previous, uint16_t current) {
    int16_t delta = (int16_t)(current - previous);
    if (delta > 2048) {
        delta -= 4096;
    } else if (delta < -2048) {
        delta += 4096;
    }
    return delta;
}

static void process_knob_values(mk3_t* dev, const uint8_t* buffer, int len) {
    const size_t count = knob_descriptor_count();
    for (size_t i = 0; i < count; i++) {
        const mk3_knob_descriptor_t* desc = &knob_descriptors[i];

        if (desc->msb_addr >= len || desc->lsb_addr >= len) {
            continue;
        }

        uint16_t current_value = ((uint16_t)buffer[desc->msb_addr] << 8) | buffer[desc->lsb_addr];

        if (!dev->knob_initialized[i]) {
            dev->knob_values[i] = current_value;
            dev->knob_initialized[i] = true;
            continue;
        }

        if (current_value == dev->knob_values[i]) {
            continue;
        }

        int16_t delta = compute_knob_delta(dev->knob_values[i], current_value);
        dev->knob_values[i] = current_value;

        if (dev->knob_callback) {
            dev->knob_callback(desc->name, delta, current_value, dev->knob_callback_userdata);
        }
    }
}

static void process_stepper(mk3_t* dev, const uint8_t* buffer, int len) {
    if (STEPPER_ADDR >= len) {
        return;
    }

    uint8_t new_position = buffer[STEPPER_ADDR] & 0x0F;

    if (!dev->stepper_initialized) {
        dev->stepper_position = new_position;
        dev->stepper_initialized = true;
        return;
    }

    if (new_position == dev->stepper_position) {
        return;
    }

    bool jump_backward = (dev->stepper_position == 0x00 && new_position == 0x0F);
    bool jump_forward = (dev->stepper_position == 0x0F && new_position == 0x00);
    bool increment = ((dev->stepper_position < new_position) && !jump_backward) || jump_forward;
    int8_t direction = increment ? 1 : -1;

    dev->stepper_position = new_position;

    if (dev->stepper_callback) {
        dev->stepper_callback(direction, new_position, dev->stepper_callback_userdata);
    }
}

static void process_report_01_inputs(mk3_t* dev, const uint8_t* buffer, int len) {
    // Ensure last_input_buffer is also from a 0x01 report for correct comparison
    bool last_buffer_was_button_report = (dev->last_input_buffer[0] == 0x01);

    for (int i = 0; i < mk3_buttons_count; i++) {
        const mk3_button_t* btn = &mk3_buttons[i];

        // btn->addr is the index in the full buffer (e.g., JSON addr 1 is buffer[1]).
        // Button addresses should be > 0, as buffer[0] is the report ID.
        if (btn->addr == 0 || btn->addr >= len) continue;

        bool now_pressed = (buffer[btn->addr] & btn->mask) != 0;
        bool was_pressed = false;

        if (last_buffer_was_button_report &&
            btn->addr > 0 && btn->addr < dev->last_report_01_len) {
            was_pressed = (dev->last_input_buffer[btn->addr] & btn->mask) != 0;
        }

        if (now_pressed && !was_pressed) {
            // printf("🔘 Button Pressed:  %s\n", btn->name); // Debug print
            if (dev->button_callback) {
                dev->button_callback(btn->name, true, dev->button_callback_userdata);
            }
        } else if (!now_pressed && was_pressed) {
            // printf("⚪ Button Released: %s\n", btn->name); // Debug print
            if (dev->button_callback) {
                dev->button_callback(btn->name, false, dev->button_callback_userdata);
            }
        }
    }
    // Copy current button report to last_input_buffer for next poll's comparison
    memcpy(dev->last_input_buffer, buffer, len);
    dev->last_report_01_len = len;

    process_knob_values(dev, buffer, len);
    process_stepper(dev, buffer, len);
}

static void process_report_02_pads(mk3_t* dev, const uint8_t* buffer, int len) {
    int offset = PAD_DATA_START_OFFSET;
    for (int i_rep = 0; i_rep < PAD_MAX_REPEATED_ENTRIES; i_rep++, offset += PAD_ENTRY_LENGTH) {
        if (offset + PAD_ENTRY_LENGTH > len) break; // Not enough data for a full entry

        uint8_t pad_hw_index = buffer[offset];
        // uint8_t weird_nibble = (buffer[offset + 1] & 0xF0) >> 4; // For debugging, usually 0x4 or 0x2/0x3 on release
        // bool is_valid_entry = (buffer[offset + 1] & 0xF0) != 0; // Check "weird" nibble

        if (pad_hw_index == 0 && i_rep != 0) { // End-of-packet marker (unless it's the first entry for pad 0)
            break;
        }
        if (pad_hw_index >= PAD_COUNT) continue; // Invalid hardware pad index

        // Map hardware index to physical pad number (1-16)
        uint8_t physical_pad_number = mk3_pad_hw_to_physical_map[pad_hw_index];
        // Convert to 0-indexed for arrays
        uint8_t physical_pad_array_index = physical_pad_number - 1;

        uint16_t pressure = ((buffer[offset + 1] & 0x0F) << 8) | buffer[offset + 2];
        dev->pad_pressures[physical_pad_array_index] = pressure;

        bool currently_pressed_state = pressure > PAD_PRESSURE_PRESS_THRESHOLD;

        if (currently_pressed_state && !dev->pad_is_pressed[physical_pad_array_index]) {
            // printf("🐾 Pad %d Pressed (Pressure: %u)\n", physical_pad_number, pressure); // Debug print
            if (dev->pad_callback) {
                dev->pad_callback(physical_pad_number, true, pressure, dev->pad_callback_userdata);
            }
        } else if (!currently_pressed_state && dev->pad_is_pressed[physical_pad_array_index]) {
            // printf("🐾 Pad %d Released\n", physical_pad_number); // Debug print
            if (dev->pad_callback) {
                dev->pad_callback(physical_pad_number, false, pressure, dev->pad_callback_userdata);
            }
        }
        dev->pad_is_pressed[physical_pad_array_index] = currently_pressed_state;
    }
}

int mk3_input_poll(mk3_t* dev) {
    if (!dev) return -1;

    uint8_t buffer[HID_INPUT_PACKET_SIZE];
    int transferred = 0;

    int res = libusb_interrupt_transfer(dev->handle, HID_INPUT_ENDPOINT, buffer, sizeof(buffer), &transferred, 100);
    if (res == LIBUSB_SUCCESS && transferred > 0) {
        // --- RAW PACKET DEBUG (Commented out for cleaner output) ---
        /*
        printf("RAW HID (len %2d, ID 0x%02X): ", transferred, buffer[0]);
        for (int k = 0; k < transferred; k++) {
            printf("%02X ", buffer[k]);
        }
        printf("\n");
        */

        if (transferred < 1) { // Should not happen if transferred > 0, but good practice
            return 0; 
        }

        uint8_t report_id = buffer[0];

        if (report_id == 0x01) { // Buttons, Knobs, Stepper, Touchstrips
            process_report_01_inputs(dev, buffer, transferred);
            return 1; // Indicate button report processed
        } else if (report_id == PAD_REPORT_ID) { // Pads
            process_report_02_pads(dev, buffer, transferred);
            return 2; // Indicate pad report received (or some other non-button code)
        } else {
            // The raw packet log above will show this already.
            // You might want to add specific handling for other known report IDs if they exist.
            return 0; // Indicate unknown report
        }
    } else if (res != LIBUSB_ERROR_TIMEOUT) {
        fprintf(stderr, "⚠️  libusb error: %s\n", libusb_error_name(res));
    }

    return 0;
}

void mk3_input_set_pad_callback(mk3_t* dev, mk3_pad_callback_t callback, void* userdata) {
    if (!dev) return;
    dev->pad_callback = callback;
    dev->pad_callback_userdata = userdata;
}
void mk3_input_set_button_callback(mk3_t* dev, mk3_button_callback_t callback, void* userdata) {
    if (!dev) return;
    dev->button_callback = callback;
    dev->button_callback_userdata = userdata;
}

void mk3_input_set_knob_callback(mk3_t* dev, mk3_knob_callback_t callback, void* userdata) {
    if (!dev) return;
    dev->knob_callback = callback;
    dev->knob_callback_userdata = userdata;
}

void mk3_input_set_stepper_callback(mk3_t* dev, mk3_stepper_callback_t callback, void* userdata) {
    if (!dev) return;
    dev->stepper_callback = callback;
    dev->stepper_callback_userdata = userdata;
}
