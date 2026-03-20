#pragma once
#include <stdint.h>
#include <stdbool.h>

typedef struct mk3 mk3_t; // opaque type for users of libmk3

// Callback function types for input events
typedef void (*mk3_pad_callback_t)(uint8_t pad_number, bool is_pressed, uint16_t pressure, void* userdata);
typedef void (*mk3_button_callback_t)(const char* button_name, bool is_pressed, void* userdata);
typedef void (*mk3_knob_callback_t)(const char* knob_name, int16_t delta, uint16_t absolute_value, void* userdata);
typedef void (*mk3_stepper_callback_t)(int8_t direction, uint8_t position, void* userdata);
// TODO: Add callbacks for touchstrip, etc.

// Lifecycle
mk3_t* mk3_open(void);
void mk3_close(mk3_t* dev);

int mk3_display_draw(mk3_t* dev, int screen_index, const uint16_t* rgb565);

// Display configuration
// TODO: Fix partial rendering bug that occurs when selecting pads in DAW sampler
// The partial rendering logic in mk3_display_draw() has a bug that causes display
// corruption when pads are selected in the DAW sampler. Until this is fixed,
// partial rendering should be disabled using mk3_display_disable_partial_rendering().
void mk3_display_disable_partial_rendering(mk3_t* dev, bool disable);

// Input polling (should be called regularly, e.g., in main loop)
int mk3_input_poll(mk3_t* dev);

// Register callbacks for input events
void mk3_input_set_pad_callback(mk3_t* dev, mk3_pad_callback_t callback, void* userdata);
void mk3_input_set_button_callback(mk3_t* dev, mk3_button_callback_t callback, void* userdata);
void mk3_input_set_knob_callback(mk3_t* dev, mk3_knob_callback_t callback, void* userdata);
void mk3_input_set_stepper_callback(mk3_t* dev, mk3_stepper_callback_t callback, void* userdata);

// Output (LEDs) - Assuming you'll use this as per the TODOs
int mk3_led_set_indexed_color(mk3_t* dev, const char* led_name, uint8_t color_index);
