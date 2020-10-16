#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "heif" for configuration "Release"
set_property(TARGET heif APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(heif PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/lib/libheif.dll.a"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/libheif.dll"
  )

list(APPEND _IMPORT_CHECK_TARGETS heif )
list(APPEND _IMPORT_CHECK_FILES_FOR_heif "${_IMPORT_PREFIX}/lib/libheif.dll.a" "${_IMPORT_PREFIX}/bin/libheif.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
