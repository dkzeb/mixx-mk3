#include "capture.h"

#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

#include <xf86drm.h>
#include <xf86drmMode.h>

struct capture_ctx {
    int drm_fd;
    /* Previous frame mapping — unmapped on next capture_frame call */
    uint8_t* prev_map;
    size_t    prev_map_size;
    int       prev_prime_fd;
};

capture_ctx_t* capture_open(int width, int height) {
    (void)width;
    (void)height;

    capture_ctx_t* ctx = calloc(1, sizeof(*ctx));
    if (!ctx) return NULL;

    ctx->drm_fd = open("/dev/dri/card0", O_RDWR);
    if (ctx->drm_fd < 0) {
        /* Fallback to card1 */
        ctx->drm_fd = open("/dev/dri/card1", O_RDWR);
        if (ctx->drm_fd < 0) {
            perror("capture_drm: open /dev/dri/card0 and card1");
            free(ctx);
            return NULL;
        }
        printf("capture_drm: opened /dev/dri/card1\n");
    } else {
        printf("capture_drm: opened /dev/dri/card0\n");
    }

    if (drmSetClientCap(ctx->drm_fd, DRM_CLIENT_CAP_UNIVERSAL_PLANES, 1) < 0) {
        fprintf(stderr, "capture_drm: drmSetClientCap(UNIVERSAL_PLANES) failed\n");
        /* Non-fatal — continue with default planes */
    }

    ctx->prev_map = NULL;
    ctx->prev_map_size = 0;
    ctx->prev_prime_fd = -1;

    return ctx;
}

const uint8_t* capture_frame(capture_ctx_t* ctx) {
    if (!ctx) return NULL;

    /* Release previous frame mapping */
    if (ctx->prev_map) {
        munmap(ctx->prev_map, ctx->prev_map_size);
        ctx->prev_map = NULL;
        ctx->prev_map_size = 0;
    }
    if (ctx->prev_prime_fd >= 0) {
        close(ctx->prev_prime_fd);
        ctx->prev_prime_fd = -1;
    }

    /* Find an active plane with a framebuffer attached */
    drmModePlaneResPtr plane_res = drmModeGetPlaneResources(ctx->drm_fd);
    if (!plane_res) {
        perror("capture_drm: drmModeGetPlaneResources");
        return NULL;
    }

    uint32_t active_fb_id = 0;

    for (uint32_t i = 0; i < plane_res->count_planes; i++) {
        drmModePlanePtr plane = drmModeGetPlane(ctx->drm_fd, plane_res->planes[i]);
        if (!plane) continue;

        if (plane->fb_id != 0) {
            active_fb_id = plane->fb_id;
            /* Width/height come from the FB object, not the plane descriptor */
            drmModeFreePlane(plane);
            break;
        }
        drmModeFreePlane(plane);
    }
    drmModeFreePlaneResources(plane_res);

    if (active_fb_id == 0) {
        fprintf(stderr, "capture_drm: no active plane found\n");
        return NULL;
    }

    /* Try drmModeGetFB2 first (supports modifiers, multi-plane), fall back to
       drmModeGetFB for older kernels */
    int prime_fd = -1;
    size_t map_size = 0;

#if defined(DRM_MODE_FB_MODIFIERS)
    drmModeFB2Ptr fb2 = drmModeGetFB2(ctx->drm_fd, active_fb_id);
    if (fb2) {
        /* 4 bytes per pixel (XRGB8888) */
        map_size = (size_t)fb2->width * fb2->height * 4;

        if (drmPrimeHandleToFD(ctx->drm_fd, fb2->handles[0], O_RDONLY, &prime_fd) < 0) {
            perror("capture_drm: drmPrimeHandleToFD (fb2)");
            prime_fd = -1;
        }
        drmModeFreeFB2(fb2);
    }
#endif

    if (prime_fd < 0) {
        /* Fallback: drmModeGetFB */
        drmModeFBPtr fb = drmModeGetFB(ctx->drm_fd, active_fb_id);
        if (!fb) {
            fprintf(stderr, "capture_drm: drmModeGetFB failed\n");
            return NULL;
        }
        map_size = (size_t)fb->width * fb->height * 4;

        if (drmPrimeHandleToFD(ctx->drm_fd, fb->handle, O_RDONLY, &prime_fd) < 0) {
            perror("capture_drm: drmPrimeHandleToFD (fb)");
            drmModeFreeFB(fb);
            return NULL;
        }
        drmModeFreeFB(fb);
    }

    if (map_size == 0) {
        fprintf(stderr, "capture_drm: zero map size\n");
        close(prime_fd);
        return NULL;
    }

    uint8_t* mapped = mmap(NULL, map_size, PROT_READ, MAP_SHARED, prime_fd, 0);
    if (mapped == MAP_FAILED) {
        perror("capture_drm: mmap");
        close(prime_fd);
        return NULL;
    }

    /* Stash for release on next call */
    ctx->prev_map      = mapped;
    ctx->prev_map_size = map_size;
    ctx->prev_prime_fd = prime_fd;

    return mapped;
}

int capture_bpp(capture_ctx_t* ctx) {
    (void)ctx;
    return 4; /* XRGB8888 */
}

void capture_close(capture_ctx_t* ctx) {
    if (!ctx) return;
    if (ctx->prev_map) {
        munmap(ctx->prev_map, ctx->prev_map_size);
    }
    if (ctx->prev_prime_fd >= 0) {
        close(ctx->prev_prime_fd);
    }
    if (ctx->drm_fd >= 0) {
        close(ctx->drm_fd);
    }
    free(ctx);
}
