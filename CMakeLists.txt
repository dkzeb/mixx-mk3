cmake_minimum_required(VERSION 3.16)
project(mixx-mk3 C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_subdirectory(external/mk3)
add_subdirectory(external/mpi-tools/mk3_test)
add_subdirectory(external/mpi-tools/mk3_cli)
# audio_cli requires the Mixxx audio lib, skip for standalone builds
# add_subdirectory(external/mpi-tools/audio_cli)

add_subdirectory(screen-daemon)
