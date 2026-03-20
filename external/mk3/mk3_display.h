#pragma once

#include "mk3.h"
#include <stdint.h>

// Draw the entire screen (uses internal diffing or tile renderer if enabled)
int mk3_display_draw(mk3_t* dev, int screen_index, const uint16_t* pixels);

// Draw a rectangular region directly
int mk3_display_draw_partial(mk3_t* dev, int screen_index, int x, int y, int w, int h, const uint16_t* pixels);

// Clear the screen with a color
int mk3_display_clear(mk3_t* dev, int screen_index, uint16_t color);
