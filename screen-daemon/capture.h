#pragma once

#include <stdint.h>
#include <stdbool.h>

typedef struct capture_ctx capture_ctx_t;

capture_ctx_t* capture_open(int width, int height);
const uint8_t* capture_frame(capture_ctx_t* ctx);
int capture_bpp(capture_ctx_t* ctx);
int capture_stride(capture_ctx_t* ctx);
void capture_close(capture_ctx_t* ctx);
