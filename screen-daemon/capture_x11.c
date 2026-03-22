#include "capture.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <X11/Xlib.h>
#include <X11/Xutil.h>

struct capture_ctx {
    Display* dpy;
    Window root;
    int width;
    int height;
    int bpp;
    int stride;
    XImage* image;
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
    return (const uint8_t*)ctx->image->data;
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
    if (ctx->dpy) XCloseDisplay(ctx->dpy);
    free(ctx);
}
