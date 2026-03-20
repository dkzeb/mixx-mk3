#include "mk3.h"
#include "mk3_internal.h"
#include "mk3_display.h"
#include <libusb.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#define VENDOR_ID  0x17CC
#define PRODUCT_ID 0x1600

static libusb_context* g_libusb_context = NULL;
static int g_libusb_refcount = 0;

static bool mk3_acquire_libusb(void)
{
    if (g_libusb_refcount == 0)
    {
        const int init_result = libusb_init(&g_libusb_context);
        if (init_result != 0)
        {
            fprintf(stderr, "Failed to initialise libusb: %s\n", libusb_error_name(init_result));
            return false;
        }
    }

    ++g_libusb_refcount;
    return true;
}

static void mk3_release_libusb(void)
{
    if (g_libusb_refcount <= 0)
        return;

    --g_libusb_refcount;
    if (g_libusb_refcount == 0)
    {
        libusb_exit(g_libusb_context);
        g_libusb_context = NULL;
    }
}

mk3_t* mk3_open(void) {
    libusb_device_handle* handle = NULL;
    mk3_t* dev = NULL;
    bool display_claimed = false;
    bool hid_claimed = false;

    if (!mk3_acquire_libusb())
        return NULL;

    handle = libusb_open_device_with_vid_pid(g_libusb_context, VENDOR_ID, PRODUCT_ID);
    if (!handle) {
        fprintf(stderr, "MK3 not found.\n");
        goto cleanup;
    }

    if (libusb_kernel_driver_active(handle, HID_INTERFACE)) {
        const int detach_res = libusb_detach_kernel_driver(handle, HID_INTERFACE);
        if (detach_res != 0) {
            fprintf(stderr, "Failed to detach kernel driver from HID interface: %s\n", libusb_error_name(detach_res));
            goto cleanup;
        }
    }

    if (libusb_claim_interface(handle, DISPLAY_INTERFACE) != 0) {
        fprintf(stderr, "Failed to claim interface %d (Display)\n", DISPLAY_INTERFACE);
        goto cleanup;
    }
    display_claimed = true;

    if (libusb_claim_interface(handle, HID_INTERFACE) != 0) {
        fprintf(stderr, "Failed to claim interface %d (HID)\n", HID_INTERFACE);
        goto cleanup;
    }
    hid_claimed = true;

    dev = calloc(1, sizeof(mk3_t));
    if (!dev)
        goto cleanup;

    dev->handle = handle;
    dev->disable_partial_rendering = false;

    dev->clear_frame_buffer = calloc(WIDTH * HEIGHT, sizeof(uint16_t));
    if (!dev->clear_frame_buffer)
        goto cleanup;

    for (int i = 0; i < 2; i++) {
        dev->last_frame[i] = calloc(WIDTH * HEIGHT, sizeof(uint16_t));
        if (!dev->last_frame[i])
            goto cleanup;
        dev->has_last_frame[i] = false;
    }

    memset(dev->output_report_80_buffer, 0, sizeof(dev->output_report_80_buffer));
    dev->output_report_80_buffer[0] = 0x80; // Report ID
    memset(dev->output_report_81_buffer, 0, sizeof(dev->output_report_81_buffer));
    dev->output_report_81_buffer[0] = 0x81; // Report ID
    dev->output_buffers_initialized = true;

    return dev;

cleanup:
    if (dev) {
        for (int i = 0; i < 2; i++) {
            free(dev->last_frame[i]);
            dev->last_frame[i] = NULL;
        }
        free(dev->clear_frame_buffer);
        dev->clear_frame_buffer = NULL;
        free(dev);
        dev = NULL;
    }

    if (handle) {
        if (hid_claimed)
            libusb_release_interface(handle, HID_INTERFACE);
        if (display_claimed)
            libusb_release_interface(handle, DISPLAY_INTERFACE);
        libusb_close(handle);
        handle = NULL;
    }

    mk3_release_libusb();
    return NULL;
}

void mk3_close(mk3_t* dev) {
    if (!dev) return;

    for (int i = 0; i < 2; i++) {
        free(dev->last_frame[i]);
        dev->last_frame[i] = NULL;
    }

    free(dev->clear_frame_buffer);
    dev->clear_frame_buffer = NULL;

    libusb_release_interface(dev->handle, DISPLAY_INTERFACE);
    libusb_release_interface(dev->handle, HID_INTERFACE);
    libusb_close(dev->handle);
    mk3_release_libusb();
    free(dev);
}

void mk3_display_disable_partial_rendering(mk3_t* dev, bool disable) {
    if (!dev) return;
    dev->disable_partial_rendering = disable;
}
