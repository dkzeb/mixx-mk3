find_package(PkgConfig REQUIRED)

option(USE_DRM_CAPTURE "Use DRM capture backend (requires libdrm)" ON)

add_executable(mk3-screen-daemon main.c)

if(USE_DRM_CAPTURE)
    pkg_check_modules(LIBDRM REQUIRED libdrm)
    target_sources(mk3-screen-daemon PRIVATE capture_drm.c)
    target_include_directories(mk3-screen-daemon PRIVATE ${LIBDRM_INCLUDE_DIRS})
    target_link_libraries(mk3-screen-daemon PRIVATE ${LIBDRM_LIBRARIES})
    target_compile_definitions(mk3-screen-daemon PRIVATE USE_DRM_CAPTURE)
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
