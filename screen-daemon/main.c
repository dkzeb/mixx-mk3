#include "capture.h"
#include "mk3.h"
#include "mk3_display.h"

#include <endian.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

/* ── Constants ─────────────────────────────────────────────────────────── */

#define MK3_SCREEN_W  480
#define MK3_SCREEN_H  272

#define DEFAULT_SRC_W  960
#define DEFAULT_SRC_H  544
#define DEFAULT_FPS     30

/* ── Signal handling ────────────────────────────────────────────────────── */

static volatile bool g_running = true;

static void handle_signal(int sig) {
    (void)sig;
    g_running = false;
}

/* ── Pixel conversion ───────────────────────────────────────────────────── */

static inline uint16_t xrgb8888_to_rgb565(uint8_t r, uint8_t g, uint8_t b) {
    return (uint16_t)(((r & 0xF8u) << 8) | ((g & 0xFCu) << 3) | (b >> 3));
}

/* ── Nearest-neighbour downscaler ───────────────────────────────────────── */
/*
 * src       – raw framebuffer bytes
 * src_x/y   – top-left corner of the source region within the framebuffer
 * src_w/h   – size of source region to sample
 * src_stride– bytes per full framebuffer row  (xres_virtual * bpp)
 * src_bpp   – bytes per pixel in the source
 * dst       – output RGB565 buffer, MK3_SCREEN_W * MK3_SCREEN_H pixels
 *
 * DRM XRGB8888 on little-endian: bytes in memory are B, G, R, X (index 0–3).
 */
static void scale_region_to_screen(
        const uint8_t* src,
        int src_x, int src_y,
        int src_w, int src_h,
        int src_stride, int src_bpp,
        uint16_t* dst)
{
    for (int dy = 0; dy < MK3_SCREEN_H; dy++) {
        int sy = src_y + (dy * src_h) / MK3_SCREEN_H;
        const uint8_t* src_row = src + (size_t)sy * src_stride;

        for (int dx = 0; dx < MK3_SCREEN_W; dx++) {
            int sx = src_x + (dx * src_w) / MK3_SCREEN_W;
            const uint8_t* px = src_row + (size_t)sx * src_bpp;

            uint8_t r, g, b;
            if (src_bpp == 4) {
                /* XRGB8888 little-endian: [B, G, R, X] */
                b = px[0];
                g = px[1];
                r = px[2];
            } else if (src_bpp == 3) {
                /* Packed BGR or RGB — assume BGR for DRM/LinuxFB default */
                b = px[0];
                g = px[1];
                r = px[2];
            } else if (src_bpp == 2) {
                /* Already RGB565 — pass through */
                uint16_t v = (uint16_t)(px[0] | ((uint16_t)px[1] << 8));
                dst[dy * MK3_SCREEN_W + dx] = v;
                continue;
            } else {
                /* 1 bpp greyscale fallback */
                r = g = b = px[0];
            }

            dst[dy * MK3_SCREEN_W + dx] = xrgb8888_to_rgb565(r, g, b);
        }
    }
}

/* ── Usage ──────────────────────────────────────────────────────────────── */

static void print_usage(const char* prog) {
    fprintf(stderr,
        "Usage: %s [OPTIONS]\n"
        "\n"
        "Mirror the framebuffer to the two MK3 480x272 screens.\n"
        "\n"
        "Options:\n"
        "  --resolution WxH   Source framebuffer resolution to capture\n"
        "                     (default: %dx%d)\n"
        "  --fps N            Target frame rate (default: %d)\n"
        "  --no-partial       Disable partial display rendering (default)\n"
        "  --partial          Enable partial display rendering\n"
        "  --help             Show this message\n",
        prog, DEFAULT_SRC_W, DEFAULT_SRC_H, DEFAULT_FPS);
}

/* ── Main ───────────────────────────────────────────────────────────────── */

int main(int argc, char* argv[]) {
    int src_w       = DEFAULT_SRC_W;
    int src_h       = DEFAULT_SRC_H;
    int fps         = DEFAULT_FPS;
    bool no_partial = true;  /* partial rendering disabled by default */

    /* ── Argument parsing ────────────────────────────────────────────── */
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--help") == 0) {
            print_usage(argv[0]);
            return 0;
        } else if (strcmp(argv[i], "--resolution") == 0) {
            if (i + 1 >= argc) {
                fprintf(stderr, "error: --resolution requires WxH argument\n");
                return 1;
            }
            i++;
            if (sscanf(argv[i], "%dx%d", &src_w, &src_h) != 2) {
                fprintf(stderr, "error: invalid resolution '%s' (expected WxH)\n", argv[i]);
                return 1;
            }
        } else if (strcmp(argv[i], "--fps") == 0) {
            if (i + 1 >= argc) {
                fprintf(stderr, "error: --fps requires an integer argument\n");
                return 1;
            }
            i++;
            fps = atoi(argv[i]);
            if (fps <= 0 || fps > 120) {
                fprintf(stderr, "error: --fps must be in range 1–120\n");
                return 1;
            }
        } else if (strcmp(argv[i], "--no-partial") == 0) {
            no_partial = true;
        } else if (strcmp(argv[i], "--partial") == 0) {
            no_partial = false;
        } else {
            fprintf(stderr, "error: unknown option '%s'\n", argv[i]);
            print_usage(argv[0]);
            return 1;
        }
    }

    /* ── Signal handlers ─────────────────────────────────────────────── */
    struct sigaction sa = {0};
    sa.sa_handler = handle_signal;
    sigaction(SIGINT,  &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    /* ── Frame timing ────────────────────────────────────────────────── */
    long frame_ns = 1000000000L / fps;

    printf("mk3-screen-daemon: %dx%d -> 2x%dx%d @ %d fps, partial=%s\n",
           src_w, src_h, MK3_SCREEN_W, MK3_SCREEN_H, fps,
           no_partial ? "disabled" : "enabled");

    /* ── Open MK3 display (retry loop) ───────────────────────────────── */
    mk3_t* dev = NULL;
    while (g_running && dev == NULL) {
        dev = mk3_open_display();
        if (!dev) {
            fprintf(stderr, "mk3-screen-daemon: mk3_open_display() failed, retrying in 2s...\n");
            sleep(2);
        }
    }
    if (!g_running) return 0;

    mk3_display_disable_partial_rendering(dev, no_partial);

    /* ── Splash screen (dark blue) ───────────────────────────────────── */
    /* RGB565 dark blue: R=0, G=0, B=16 → 0x0010 */
    uint16_t splash = xrgb8888_to_rgb565(0, 0, 64);
    mk3_display_clear(dev, 0, splash);
    mk3_display_clear(dev, 1, splash);

    /* ── Open capture backend ────────────────────────────────────────── */
    capture_ctx_t* cap = capture_open(src_w, src_h);
    if (!cap) {
        fprintf(stderr, "mk3-screen-daemon: capture_open() failed\n");
        mk3_close_display(dev);
        return 1;
    }

    int bpp = capture_bpp(cap);
    /* Stride = virtual width * bpp.  For LinuxFB xres_virtual may be wider
       than xres; for DRM we just use src_w as a reasonable default (the
       DRM backend exposes a contiguous DMA-BUF with no padding in common
       cases).  If you need accurate stride, extend the capture API. */
    int src_stride = src_w * bpp;

    /* Allocate per-screen RGB565 buffer */
    uint16_t* screen_buf = malloc((size_t)MK3_SCREEN_W * MK3_SCREEN_H * sizeof(uint16_t));
    if (!screen_buf) {
        fprintf(stderr, "mk3-screen-daemon: OOM allocating screen buffer\n");
        capture_close(cap);
        mk3_close_display(dev);
        return 1;
    }

    /* ── Main loop ───────────────────────────────────────────────────── */
    int consecutive_failures = 0;
    const int MAX_FAILURES    = 10;

    while (g_running) {
        struct timespec t_start;
        clock_gettime(CLOCK_MONOTONIC, &t_start);

        /* Capture frame */
        const uint8_t* frame = capture_frame(cap);
        if (!frame) {
            fprintf(stderr, "mk3-screen-daemon: capture_frame() returned NULL\n");
            consecutive_failures++;
            goto check_reconnect;
        }

        /* Left half: x=0 .. src_w/2 */
        scale_region_to_screen(frame,
                                0, 0,
                                src_w / 2, src_h,
                                src_stride, bpp,
                                screen_buf);
        if (mk3_display_draw(dev, 0, screen_buf) < 0) {
            consecutive_failures++;
            goto check_reconnect;
        }

        /* Right half: x=src_w/2 .. src_w */
        scale_region_to_screen(frame,
                                src_w / 2, 0,
                                src_w / 2, src_h,
                                src_stride, bpp,
                                screen_buf);
        if (mk3_display_draw(dev, 1, screen_buf) < 0) {
            consecutive_failures++;
            goto check_reconnect;
        }

        consecutive_failures = 0;
        goto frame_delay;

check_reconnect:
        if (consecutive_failures >= MAX_FAILURES) {
            fprintf(stderr,
                    "mk3-screen-daemon: %d consecutive failures — reconnecting...\n",
                    MAX_FAILURES);
            mk3_close_display(dev);
            dev = NULL;
            consecutive_failures = 0;

            while (g_running && dev == NULL) {
                dev = mk3_open_display();
                if (!dev) {
                    fprintf(stderr, "mk3-screen-daemon: reconnect failed, retrying in 2s...\n");
                    sleep(2);
                }
            }
            if (!g_running) break;

            mk3_display_disable_partial_rendering(dev, no_partial);
        }

frame_delay:
        {
            struct timespec t_now;
            clock_gettime(CLOCK_MONOTONIC, &t_now);
            long elapsed_ns = (long)(t_now.tv_sec  - t_start.tv_sec)  * 1000000000L
                            + (long)(t_now.tv_nsec - t_start.tv_nsec);
            long sleep_ns = frame_ns - elapsed_ns;
            if (sleep_ns > 0) {
                struct timespec ts = { .tv_sec  = sleep_ns / 1000000000L,
                                       .tv_nsec = sleep_ns % 1000000000L };
                nanosleep(&ts, NULL);
            }
        }
    }

    /* ── Clean shutdown ──────────────────────────────────────────────── */
    printf("\nmk3-screen-daemon: shutting down\n");

    if (dev) {
        mk3_display_clear(dev, 0, 0x0000);
        mk3_display_clear(dev, 1, 0x0000);
        mk3_close_display(dev);
    }

    capture_close(cap);
    free(screen_buf);
    return 0;
}
