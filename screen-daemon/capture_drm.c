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

/* Try to open a DRM card and verify it has planes with active framebuffers */
static int try_open_card(const char* path) {
    int fd = open(path, O_RDWR);
    if (fd < 0) return -1;

    /* Need master or at least universal planes cap */
    if (drmSetClientCap(fd, DRM_CLIENT_CAP_UNIVERSAL_PLANES, 1) < 0) {
        /* Try without — some drivers support getPlaneResources without the cap */
    }

    /* Check if this card has any planes (i.e., is a display controller) */
    drmModePlaneResPtr planes = drmModeGetPlaneResources(fd);
    if (!planes) {
        fprintf(stderr, "capture_drm: %s — no plane resources\n", path);
        close(fd);
        return -1;
    }

    /* Check if any plane has an active framebuffer */
    int has_active = 0;
    for (uint32_t i = 0; i < planes->count_planes; i++) {
        drmModePlanePtr p = drmModeGetPlane(fd, planes->planes[i]);
        if (p) {
            if (p->fb_id != 0) has_active = 1;
            drmModeFreePlane(p);
        }
        if (has_active) break;
    }
    drmModeFreePlaneResources(planes);

    if (has_active) {
        fprintf(stderr, "capture_drm: %s — found active display plane\n", path);
    } else {
        fprintf(stderr, "capture_drm: %s — %u planes but none active (no display connected?)\n",
                path, planes->count_planes);
    }

    return fd;
}

capture_ctx_t* capture_open(int width, int height) {
    (void)width;
    (void)height;

    capture_ctx_t* ctx = calloc(1, sizeof(*ctx));
    if (!ctx) return NULL;

    ctx->drm_fd = -1;
    ctx->prev_map = NULL;
    ctx->prev_map_size = 0;
    ctx->prev_prime_fd = -1;

    /* Try all available DRM cards */
    const char* cards[] = {"/dev/dri/card0", "/dev/dri/card1", "/dev/dri/card2", NULL};
    for (int i = 0; cards[i]; i++) {
        int fd = try_open_card(cards[i]);
        if (fd >= 0) {
            ctx->drm_fd = fd;
            break;
        }
    }

    if (ctx->drm_fd < 0) {
        fprintf(stderr, "capture_drm: no usable DRM card found\n");
        free(ctx);
        return NULL;
    }

    return ctx;
}

const uint8_t* capture_frame(capture_ctx_t* ctx) {
    if (!ctx || ctx->drm_fd < 0) return NULL;

    /* Release previous mapping */
    if (ctx->prev_map) {
        munmap(ctx->prev_map, ctx->prev_map_size);
        ctx->prev_map = NULL;
    }
    if (ctx->prev_prime_fd >= 0) {
        close(ctx->prev_prime_fd);
        ctx->prev_prime_fd = -1;
    }

    /* Find active plane with a framebuffer */
    drmModePlaneResPtr plane_res = drmModeGetPlaneResources(ctx->drm_fd);
    if (!plane_res) {
        fprintf(stderr, "capture_drm: drmModeGetPlaneResources: %m\n");
        return NULL;
    }

    uint32_t active_fb_id = 0;
    for (uint32_t i = 0; i < plane_res->count_planes; i++) {
        drmModePlanePtr plane = drmModeGetPlane(ctx->drm_fd, plane_res->planes[i]);
        if (plane && plane->fb_id) {
            active_fb_id = plane->fb_id;
            drmModeFreePlane(plane);
            break;
        }
        if (plane) drmModeFreePlane(plane);
    }
    drmModeFreePlaneResources(plane_res);

    if (active_fb_id == 0) return NULL;

    /* Get framebuffer info and export as DMA-BUF */
    int prime_fd = -1;
    size_t map_size = 0;

#if defined(DRM_MODE_FB_MODIFIERS)
    drmModeFB2Ptr fb2 = drmModeGetFB2(ctx->drm_fd, active_fb_id);
    if (fb2) {
        map_size = (size_t)fb2->pitches[0] * fb2->height;
        if (drmPrimeHandleToFD(ctx->drm_fd, fb2->handles[0], O_RDONLY, &prime_fd) < 0) {
            prime_fd = -1;
        }
        drmModeFreeFB2(fb2);
    }
#endif

    if (prime_fd < 0) {
        drmModeFBPtr fb = drmModeGetFB(ctx->drm_fd, active_fb_id);
        if (!fb) return NULL;
        map_size = (size_t)fb->pitch * fb->height;
        if (!fb->handle || drmPrimeHandleToFD(ctx->drm_fd, fb->handle, O_RDONLY, &prime_fd) < 0) {
            drmModeFreeFB(fb);
            return NULL;
        }
        drmModeFreeFB(fb);
    }

    if (map_size == 0 || prime_fd < 0) {
        if (prime_fd >= 0) close(prime_fd);
        return NULL;
    }

    uint8_t* mapped = mmap(NULL, map_size, PROT_READ, MAP_SHARED, prime_fd, 0);
    if (mapped == MAP_FAILED) {
        close(prime_fd);
        return NULL;
    }

    ctx->prev_map = mapped;
    ctx->prev_map_size = map_size;
    ctx->prev_prime_fd = prime_fd;

    return mapped;
}

int capture_bpp(capture_ctx_t* ctx) {
    (void)ctx;
    return 4; /* XRGB8888 */
}

int capture_stride(capture_ctx_t* ctx) {
    (void)ctx;
    return 0; /* unknown — main.c falls back to width * bpp */
}

void capture_close(capture_ctx_t* ctx) {
    if (!ctx) return;
    if (ctx->prev_map) munmap(ctx->prev_map, ctx->prev_map_size);
    if (ctx->prev_prime_fd >= 0) close(ctx->prev_prime_fd);
    if (ctx->drm_fd >= 0) close(ctx->drm_fd);
    free(ctx);
}
