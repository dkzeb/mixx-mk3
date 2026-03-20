add_library(mk3 STATIC 
    mk3.c
    mk3_display.c    
    mk3_input.c
    mk3_input_map.c
    mk3_output.c
    mk3_output_map.c
)

find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBUSB REQUIRED libusb-1.0)

target_include_directories(mk3 PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${LIBUSB_INCLUDE_DIRS}
)

target_link_libraries(mk3 PUBLIC ${LIBUSB_LIBRARIES})

# (Optional) Explicitly list headers for IDE or install support
target_sources(mk3 PRIVATE
    mk3.h
    mk3_display.h
    mk3_input.h
    mk3_input_map.h
    mk3_output.h
    mk3_output_map.h
    mk3_internal.h
)
