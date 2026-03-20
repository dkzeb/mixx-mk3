#include "mk3_output.h"
#include "mk3_internal.h"
#include "mk3_output_map.h" // For mk3_leds array
#include <stdio.h>
#include <string.h>
#include <libusb.h>

// Helper function to find LED definition by name
static const mk3_led_definition_t* find_led_def(const char* led_name) {
    for (int i = 0; i < mk3_leds_count; ++i) {
        if (strcmp(mk3_leds[i].name, led_name) == 0) {
            return &mk3_leds[i];
        }
    }
    return NULL;
}

// Helper function to send an output report
static int send_output_report(mk3_t* dev, uint8_t report_id, uint8_t* buffer, int length) {
    if (!dev || !dev->handle) return -1;

    // Ensure buffer[0] is the report_id, though it should already be set.
    buffer[0] = report_id;

    int transferred = 0;
    // Use libusb_control_transfer for SetReport on HID devices as per HID spec
    // Or libusb_interrupt_transfer if the device uses an explicit OUT endpoint for reports
    // For MK3, HID_OUTPUT_ENDPOINT (0x03) is an interrupt OUT endpoint.
    int res = libusb_interrupt_transfer(dev->handle,
                                        HID_OUTPUT_ENDPOINT,
                                        buffer,
                                        length,
                                        &transferred,
                                        100); // 100ms timeout

    if (res != LIBUSB_SUCCESS) {
        fprintf(stderr, "Failed to send LED report 0x%02X: %s\n", report_id, libusb_error_name(res));
        return -1;
    }
    if (transferred != length) {
        fprintf(stderr, "LED report 0x%02X: Incomplete transfer (%d/%d bytes)\n", report_id, transferred, length);
        return -2;
    }
    return 0;
}

int mk3_led_set_brightness(mk3_t* dev, const char* led_name, uint8_t brightness) {
    if (!dev) return -1;
    const mk3_led_definition_t* led_def = find_led_def(led_name);
    if (!led_def) {
        fprintf(stderr, "LED not found: %s\n", led_name);
        return -1;
    }
    if (led_def->type != MK3_LED_TYPE_MONO) {
        fprintf(stderr, "LED %s is not a monochromatic LED.\n", led_name);
        return -1;
    }

    uint8_t val = brightness > 63 ? 63 : brightness; // Cap at 63 for MK3

    if (led_def->report_id == 0x80) {
        dev->output_report_80_buffer[led_def->addr] = val;
        return send_output_report(dev, 0x80, dev->output_report_80_buffer, sizeof(dev->output_report_80_buffer));
    }
    // Add other report IDs if mono LEDs exist there
    fprintf(stderr, "LED %s has unhandled report ID 0x%02X for mono type.\n", led_name, led_def->report_id);
    return -1;
}

int mk3_led_set_indexed_color(mk3_t* dev, const char* led_name, uint8_t color_index) {
    if (!dev) return -1;
    const mk3_led_definition_t* led_def = find_led_def(led_name);
    if (!led_def) {
        fprintf(stderr, "LED not found: %s\n", led_name);
        return -1;
    }
    if (led_def->type != MK3_LED_TYPE_INDEXED) {
        fprintf(stderr, "LED %s is not an indexed color LED.\n", led_name);
        return -1;
    }

    uint8_t val = color_index > 71 ? 0 : color_index; // Cap at 71 (typical max index)

    if (led_def->report_id == 0x80) {
        dev->output_report_80_buffer[led_def->addr] = val;
        return send_output_report(dev, 0x80, dev->output_report_80_buffer, sizeof(dev->output_report_80_buffer));
    } else if (led_def->report_id == 0x81) {
        dev->output_report_81_buffer[led_def->addr] = val;
        return send_output_report(dev, 0x81, dev->output_report_81_buffer, sizeof(dev->output_report_81_buffer));
    }
    fprintf(stderr, "LED %s has unhandled report ID 0x%02X for indexed type.\n", led_name, led_def->report_id);
    return -1;
}