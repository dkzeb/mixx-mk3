#ifndef MK3_OUTPUT_MAP_H
#define MK3_OUTPUT_MAP_H

#include <stdint.h>

typedef enum {
    MK3_LED_TYPE_MONO,    // For LEDs that take a brightness value (0-63 for MK3)
    MK3_LED_TYPE_INDEXED  // For LEDs that take a color index (0-71 for MK3)
} mk3_led_type_t;

typedef struct {
    const char* name;
    uint8_t report_id; // The HID report ID (e.g., 0x80, 0x81)
    uint8_t addr;      // The byte address *within the data part* of the report packet
                       // (e.g., if JSON addr is 1, this is 1, for buffer[1])
    mk3_led_type_t type;
} mk3_led_definition_t;

extern const mk3_led_definition_t mk3_leds[];
extern const int mk3_leds_count;

#endif //MK3_OUTPUT_MAP_H