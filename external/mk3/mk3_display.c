#include "mk3_display.h"
#include "mk3_internal.h"
#include <string.h>
#include <libusb.h>
#include <endian.h>
#include <stdio.h>
#include <stdlib.h>

#define FRAME_PIXELS (WIDTH * HEIGHT)
#define FRAME_SIZE (16 + 4 + FRAME_PIXELS * 2 + 8)
#define DISPLAY_ENDPOINT 0x04

// Helper function to draw a full screen frame
static int _mk3_display_draw_full_frame_internal(mk3_t* dev, int screen_index, const uint16_t* pixels) {
    uint8_t* frame = malloc(FRAME_SIZE);
    if (!frame) return -1;

    // Header
    memset(frame, 0, 16);
    frame[0] = 0x84;
    frame[1] = 0x00;
    frame[2] = screen_index;
    frame[3] = 0x60;
    frame[8]  = 0x00; frame[9]  = 0x00; // X start
    frame[10] = 0x00; frame[11] = 0x00; // Y start
    frame[12] = (WIDTH >> 8); frame[13] = (WIDTH & 0xFF);
    frame[14] = (HEIGHT >> 8); frame[15] = (HEIGHT & 0xFF);

    int half = FRAME_PIXELS / 2;
    frame[16] = 0x00;
    frame[17] = (half >> 16) & 0xFF;
    frame[18] = (half >> 8) & 0xFF;
    frame[19] = half & 0xFF;

    uint16_t* out = (uint16_t*)(frame + 20);
    for (int i = 0; i < FRAME_PIXELS; i++) {
        out[i] = htobe16(pixels[i]);
    }

    frame[FRAME_SIZE - 8] = 0x03;
    frame[FRAME_SIZE - 4] = 0x40;

    int transferred = 0;
    int res = libusb_bulk_transfer(dev->handle, DISPLAY_ENDPOINT, frame, FRAME_SIZE, &transferred, 1000);
    free(frame);

    return (res == 0 && transferred == FRAME_SIZE) ? 0 : -1;
}

int mk3_display_draw_partial(mk3_t* dev, int screen_index, int x, int y, int w, int h, const uint16_t* pixels) {
    if (!dev || !pixels || w <= 0 || h <= 0) return -1;

    const int region_pixels = w * h;
    const int frame_size = 16 + 4 + region_pixels * 2 + 8;
    uint8_t* frame = malloc(frame_size);
    if (!frame) return -1;

    // Header
    memset(frame, 0, 16);
    frame[0] = 0x84;
    frame[1] = 0x00;
    frame[2] = screen_index;
    frame[3] = 0x60;

    frame[8]  = (x >> 8); frame[9]  = (x & 0xFF);
    frame[10] = (y >> 8); frame[11] = (y & 0xFF);
    frame[12] = (w >> 8); frame[13] = (w & 0xFF);
    frame[14] = (h >> 8); frame[15] = (h & 0xFF);

    // Command
    int half = region_pixels / 2;
    frame[16] = 0x00;
    frame[17] = (half >> 16) & 0xFF;
    frame[18] = (half >> 8) & 0xFF;
    frame[19] = half & 0xFF;

    // Pixel data
    uint16_t* out = (uint16_t*)(frame + 20);
    for (int i = 0; i < region_pixels; i++) {
        out[i] = htobe16(pixels[i]);
    }

    // Footer
    frame[frame_size - 8] = 0x03;
    frame[frame_size - 4] = 0x40;

    int transferred = 0;
    int res = libusb_bulk_transfer(dev->handle, DISPLAY_ENDPOINT, frame, frame_size, &transferred, 1000);
    free(frame);

    if (res != 0 || transferred != frame_size) {
        fprintf(stderr, "Partial transfer failed: %s (%d/%d bytes)\n",
                libusb_error_name(res), transferred, frame_size);
        return -1;
    }

    return 0;
}

int mk3_display_draw(mk3_t* dev, int screen_index, const uint16_t* pixels) {
    if (!dev || !pixels) return -1;

    uint16_t* last = dev->last_frame[screen_index];
    bool* has_last = &dev->has_last_frame[screen_index];

    // TODO: Fix partial rendering bug that occurs when selecting pads in DAW sampler
    // When disable_partial_rendering is true, always do full screen updates
    if (dev->disable_partial_rendering) {
        // Force full screen update by skipping diffing logic
        int result = _mk3_display_draw_full_frame_internal(dev, screen_index, pixels);
        // Update last frame for consistency only if transfer was successful
        if (result == 0) {
            memcpy(last, pixels, WIDTH * HEIGHT * sizeof(uint16_t));
            *has_last = true;
        }
        return result;
    }

    if (*has_last) {
        int min_x = WIDTH, max_x = -1;
        int min_y = HEIGHT, max_y = -1;

        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                int i = y * WIDTH + x;
                if (pixels[i] != last[i]) {
                    if (x < min_x) min_x = x;
                    if (x > max_x) max_x = x;
                    if (y < min_y) min_y = y;
                    if (y > max_y) max_y = y;
                }
            }
        }

        if (min_x > max_x || min_y > max_y) return 0;

        int w = max_x - min_x + 1;
        int h = max_y - min_y + 1;
        uint16_t* region = malloc(w * h * sizeof(uint16_t));
        if (!region) return -1;

        for (int y = 0; y < h; y++) {
            memcpy(
                region + y * w,
                pixels + (min_y + y) * WIDTH + min_x,
                w * sizeof(uint16_t)
            );
        }

        int result = mk3_display_draw_partial(dev, screen_index, min_x, min_y, w, h, region);
        free(region);
        // Update last frame for consistency only if partial transfer was successful
        if (result == 0) {
            memcpy(last, pixels, WIDTH * HEIGHT * sizeof(uint16_t));
        }
        return result;
    }

    // First-time full frame
    int result = _mk3_display_draw_full_frame_internal(dev, screen_index, pixels);
    // Update last frame for consistency only if transfer was successful
    if (result == 0) {
        *has_last = true;
        memcpy(last, pixels, WIDTH * HEIGHT * sizeof(uint16_t));
    }
    return result;
}

int mk3_display_clear(mk3_t* dev, int screen_index, uint16_t color) {
    if (!dev)
        return -1;

    if (dev->clear_frame_buffer == NULL)
    {
        dev->clear_frame_buffer = calloc(WIDTH * HEIGHT, sizeof(uint16_t));
        if (dev->clear_frame_buffer == NULL)
            return -1;
    }

    for (int i = 0; i < WIDTH * HEIGHT; i++) {
        dev->clear_frame_buffer[i] = color;
    }

    return mk3_display_draw(dev, screen_index, dev->clear_frame_buffer);
}
