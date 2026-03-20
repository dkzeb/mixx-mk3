#ifndef MK3_INPUT_MAP_H
#define MK3_INPUT_MAP_H

#include <stdint.h>

typedef struct {
    const char* name;
    uint8_t addr;
    uint8_t mask;
} mk3_button_t;

extern const mk3_button_t mk3_buttons[];
extern const int mk3_buttons_count;

// Maps hardware pad index (0-15) to physical pad number (1-16)
extern const uint8_t mk3_pad_hw_to_physical_map[16];

#endif
