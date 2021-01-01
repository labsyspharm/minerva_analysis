#----------------------------------------------------------------
# Generated CMake target import file for configuration "Release".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "libde265" for configuration "Release"
set_property(TARGET libde265 APPEND PROPERTY IMPORTED_CONFIGURATIONS RELEASE)
set_target_properties(libde265 PROPERTIES
  IMPORTED_IMPLIB_RELEASE "${_IMPORT_PREFIX}/lib/libde265.dll.a"
  IMPORTED_LOCATION_RELEASE "${_IMPORT_PREFIX}/bin/libde265.dll"
  )

list(APPEND _IMPORT_CHECK_TARGETS libde265 )
list(APPEND _IMPORT_CHECK_FILES_FOR_libde265 "${_IMPORT_PREFIX}/lib/libde265.dll.a" "${_IMPORT_PREFIX}/bin/libde265.dll" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
