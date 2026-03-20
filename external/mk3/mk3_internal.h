#ifndef MK3_INTERNAL_H
#define MK3_INTERNAL_H

#include <stdint.h>
#include <stdbool.h>
#include <libusb.h>

#include "mk3.h" // For callback types
// 💡 Display dimensions
#define WIDTH 480
#define HEIGHT 272

// 🧩 USB interface numbers (from lsusb / descriptors)
#define DISPLAY_INTERFACE     5
#define HID_INTERFACE         4

// 🔌 USB endpoint addresses
#define DISPLAY_ENDPOINT      0x04  // Bulk OUT
#define HID_INPUT_ENDPOINT    0x83  // Interrupt IN
#define HID_OUTPUT_ENDPOINT   0x03  // Interrupt OUT

#define HID_INPUT_PACKET_SIZE 64
#define MK3_KNOB_VALUE_COUNT 11

typedef struct mk3 {
    libusb_device_handle* handle;

    // Display
    uint16_t* last_frame[2];           // For diffing
    bool has_last_frame[2];           // True after first draw
    bool disable_partial_rendering;   // Optional fallback
    uint16_t* clear_frame_buffer;     // Reusable buffer for screen clears

    // TODO: LED state, input, etc.
    uint8_t last_input_buffer[HID_INPUT_PACKET_SIZE]; // For edge detection
    int last_report_01_len;                           // Length of valid data in last_input_buffer for 0x01 reports

    // Pad state (Report ID 0x02)
    uint16_t pad_pressures[16];                       // Current pressure for each of the 16 pads
    bool pad_is_pressed[16];                          // True if pad is considered pressed (above threshold)

    // Knob state (Report ID 0x01)
    uint16_t knob_values[MK3_KNOB_VALUE_COUNT];       // Last known value for each knob/encoder
    bool knob_initialized[MK3_KNOB_VALUE_COUNT];      // True once baseline is captured

    // Stepper state (Report ID 0x01)
    uint8_t stepper_position;                         // Last raw position (0-15) for the nav wheel
    bool stepper_initialized;                         // False until first report has been seen

    // Input Callbacks
    mk3_pad_callback_t pad_callback;
    void* pad_callback_userdata;
    mk3_button_callback_t button_callback;
    void* button_callback_userdata;
    mk3_knob_callback_t knob_callback;
    void* knob_callback_userdata;
    mk3_stepper_callback_t stepper_callback;
    void* stepper_callback_userdata;

    // Output LED state buffers
    uint8_t output_report_80_buffer[63]; // Report ID 0x80, 63 bytes total
    uint8_t output_report_81_buffer[42]; // Report ID 0x81, 42 bytes total
    bool output_buffers_initialized;
} mk3_t;

#endif
