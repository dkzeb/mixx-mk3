#ifndef MK3_OUTPUT_H
#define MK3_OUTPUT_H

#include "mk3.h"
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Max brightness for mono LEDs on MK3 is 63.
// Color indices for indexed LEDs are typically 0 (off), 4-67 (colors), 68-71 (whites).

// Sets the brightness of a monochromatic LED.
int mk3_led_set_brightness(mk3_t* dev, const char* led_name, uint8_t brightness);

// Sets the color of an indexed LED.
int mk3_led_set_indexed_color(mk3_t* dev, const char* led_name, uint8_t color_index);

#ifdef __cplusplus
}
#endif

#endif //MK3_OUTPUT_H