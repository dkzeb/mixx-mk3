#include "capture.h"

#include <fcntl.h>
#include <linux/fb.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <unistd.h>

struct capture_ctx {
    int fd;
    struct fb_var_screeninfo vinfo;
    uint8_t* fb_ptr;
    size_t fb_size;
};

capture_ctx_t* capture_open(int width, int height) {
    (void)width;
    (void)height;

    capture_ctx_t* ctx = calloc(1, sizeof(*ctx));
    if (!ctx) return NULL;

    ctx->fd = open("/dev/fb0", O_RDONLY);
    if (ctx->fd < 0) {
        perror("capture_linuxfb: open /dev/fb0");
        free(ctx);
        return NULL;
    }

    if (ioctl(ctx->fd, FBIOGET_VSCREENINFO, &ctx->vinfo) < 0) {
        perror("capture_linuxfb: FBIOGET_VSCREENINFO");
        close(ctx->fd);
        free(ctx);
        return NULL;
    }

    ctx->fb_size = (size_t)ctx->vinfo.xres_virtual
                 * ctx->vinfo.yres_virtual
                 * (ctx->vinfo.bits_per_pixel / 8);

    ctx->fb_ptr = mmap(NULL, ctx->fb_size, PROT_READ, MAP_SHARED, ctx->fd, 0);
    if (ctx->fb_ptr == MAP_FAILED) {
        perror("capture_linuxfb: mmap");
        close(ctx->fd);
        free(ctx);
        return NULL;
    }

    printf("capture_linuxfb: %ux%u @ %ubpp\n",
           ctx->vinfo.xres, ctx->vinfo.yres, ctx->vinfo.bits_per_pixel);

    return ctx;
}

const uint8_t* capture_frame(capture_ctx_t* ctx) {
    if (!ctx) return NULL;
    /* The mmap is MAP_SHARED — the kernel updates the mapping live, so we
       simply return the pointer to the current framebuffer contents. */
    return ctx->fb_ptr;
}

int capture_bpp(capture_ctx_t* ctx) {
    if (!ctx) return 0;
    return (int)(ctx->vinfo.bits_per_pixel / 8);
}

int capture_stride(capture_ctx_t* ctx) {
    if (!ctx) return 0;
    return (int)(ctx->vinfo.xres * ctx->vinfo.bits_per_pixel / 8);
}

void capture_close(capture_ctx_t* ctx) {
    if (!ctx) return;
    if (ctx->fb_ptr && ctx->fb_ptr != MAP_FAILED)
        munmap(ctx->fb_ptr, ctx->fb_size);
    if (ctx->fd >= 0)
        close(ctx->fd);
    free(ctx);
}
