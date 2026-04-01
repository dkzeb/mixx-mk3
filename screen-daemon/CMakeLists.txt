find_package(PkgConfig REQUIRED)

set(CAPTURE_BACKEND "x11" CACHE STRING "Capture backend: x11, drm, or linuxfb")

add_executable(mk3-screen-daemon main.c)

if(CAPTURE_BACKEND STREQUAL "x11")
    find_package(X11 REQUIRED)
    target_sources(mk3-screen-daemon PRIVATE capture_x11.c)
    target_link_libraries(mk3-screen-daemon PRIVATE X11 Xext Xfixes)
elseif(CAPTURE_BACKEND STREQUAL "drm")
    pkg_check_modules(LIBDRM REQUIRED libdrm)
    target_sources(mk3-screen-daemon PRIVATE capture_drm.c)
    target_include_directories(mk3-screen-daemon PRIVATE ${LIBDRM_INCLUDE_DIRS})
    target_link_libraries(mk3-screen-daemon PRIVATE ${LIBDRM_LIBRARIES})
else()
    target_sources(mk3-screen-daemon PRIVATE capture_linuxfb.c)
endif()

set_target_properties(mk3-screen-daemon PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
)

target_include_directories(mk3-screen-daemon PRIVATE
    ${CMAKE_SOURCE_DIR}/external/mk3
)

target_link_libraries(mk3-screen-daemon PRIVATE mk3)
