#include "capture.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/extensions/Xfixes.h>

struct capture_ctx {
    Display* dpy;
    Window root;
    int width;
    int height;
    int bpp;
    int stride;
    XImage* image;
    uint8_t* composite_buf;  /* frame + cursor composited */
    bool has_xfixes;
};

capture_ctx_t* capture_open(int width, int height) {
    (void)width;
    (void)height;

    capture_ctx_t* ctx = calloc(1, sizeof(*ctx));
    if (!ctx) return NULL;

    ctx->dpy = XOpenDisplay(NULL);
    if (!ctx->dpy) {
        fprintf(stderr, "capture_x11: cannot open display (is DISPLAY set?)\n");
        free(ctx);
        return NULL;
    }

    Screen* screen = DefaultScreenOfDisplay(ctx->dpy);
    ctx->root = DefaultRootWindow(ctx->dpy);
    ctx->width = screen->width;
    ctx->height = screen->height;
    ctx->bpp = 4;
    ctx->stride = ctx->width * 4;
    ctx->image = NULL;
    ctx->composite_buf = NULL;

    /* Check for XFIXES extension (needed for cursor compositing) */
    int xfixes_event, xfixes_error;
    ctx->has_xfixes = XFixesQueryExtension(ctx->dpy, &xfixes_event, &xfixes_error);
    if (ctx->has_xfixes) {
        ctx->composite_buf = malloc((size_t)ctx->width * ctx->height * 4);
        if (!ctx->composite_buf) {
            ctx->has_xfixes = false;
            fprintf(stderr, "capture_x11: OOM for cursor composite buffer, cursor disabled\n");
        } else {
            fprintf(stderr, "capture_x11: XFIXES available, cursor compositing enabled\n");
        }
    } else {
        fprintf(stderr, "capture_x11: XFIXES not available, cursor will not be visible\n");
    }

    /* IncludeInferiors: when we XGetImage the root window, include all
       child windows' content — this is how scrot works */
    XSetSubwindowMode(ctx->dpy, DefaultGC(ctx->dpy, DefaultScreen(ctx->dpy)),
                      IncludeInferiors);

    fprintf(stderr, "capture_x11: display %dx%d depth=%d\n",
            ctx->width, ctx->height, DefaultDepthOfScreen(screen));

    return ctx;
}

const uint8_t* capture_frame(capture_ctx_t* ctx) {
    if (!ctx || !ctx->dpy) return NULL;

    if (ctx->image) {
        XDestroyImage(ctx->image);
        ctx->image = NULL;
    }

    ctx->image = XGetImage(ctx->dpy, ctx->root,
                           0, 0, ctx->width, ctx->height,
                           AllPlanes, ZPixmap);
    if (!ctx->image) return NULL;

    ctx->bpp = ctx->image->bits_per_pixel / 8;
    ctx->stride = ctx->image->bytes_per_line;

    if (!ctx->has_xfixes || !ctx->composite_buf)
        return (const uint8_t*)ctx->image->data;

    /* Copy frame into composite buffer, then overlay cursor */
    size_t frame_size = (size_t)ctx->stride * ctx->height;
    memcpy(ctx->composite_buf, ctx->image->data, frame_size);

    XFixesCursorImage* cursor = XFixesGetCursorImage(ctx->dpy);
    if (!cursor)
        return ctx->composite_buf;

    /* cursor->pixels is unsigned long* (ARGB, one pixel per element).
       cursor->x/y is the cursor position; xhot/yhot is the hotspot offset. */
    int cx = cursor->x - cursor->xhot;
    int cy = cursor->y - cursor->yhot;

    for (int row = 0; row < (int)cursor->height; row++) {
        int dy = cy + row;
        if (dy < 0 || dy >= ctx->height) continue;

        for (int col = 0; col < (int)cursor->width; col++) {
            int dx = cx + col;
            if (dx < 0 || dx >= ctx->width) continue;

            unsigned long px = cursor->pixels[row * cursor->width + col];
            uint8_t a = (px >> 24) & 0xFF;
            if (a == 0) continue;

            uint8_t cr = (px >> 16) & 0xFF;
            uint8_t cg = (px >>  8) & 0xFF;
            uint8_t cb = (px >>  0) & 0xFF;

            uint8_t* dst = ctx->composite_buf + (size_t)dy * ctx->stride + (size_t)dx * ctx->bpp;

            if (a == 255) {
                /* Opaque — direct write (BGRA layout) */
                dst[0] = cb;
                dst[1] = cg;
                dst[2] = cr;
            } else {
                /* Alpha blend */
                uint8_t inv = 255 - a;
                dst[0] = (uint8_t)((cb * a + dst[0] * inv) / 255);
                dst[1] = (uint8_t)((cg * a + dst[1] * inv) / 255);
                dst[2] = (uint8_t)((cr * a + dst[2] * inv) / 255);
            }
        }
    }

    XFree(cursor);
    return ctx->composite_buf;
}

int capture_bpp(capture_ctx_t* ctx) {
    return ctx ? ctx->bpp : 0;
}

int capture_stride(capture_ctx_t* ctx) {
    return ctx ? ctx->stride : 0;
}

void capture_close(capture_ctx_t* ctx) {
    if (!ctx) return;
    if (ctx->image) XDestroyImage(ctx->image);
    free(ctx->composite_buf);
    if (ctx->dpy) XCloseDisplay(ctx->dpy);
    free(ctx);
}
