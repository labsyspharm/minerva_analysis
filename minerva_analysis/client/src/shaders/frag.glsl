#version 300 es
precision highp int;
precision highp float;
precision highp usampler2D;

uniform usampler2D u_centers;
uniform usampler2D u_degrees;
uniform usampler2D u_tile;
uniform usampler2D u_ids;
uniform vec2 u_tile_size;
uniform vec3 u_tile_color;
uniform vec2 u_tile_range;
uniform vec2 u_tile_origin;
uniform vec2 u_corrections;
uniform bvec2 u_draw_mode;
uniform ivec3 u_center_shape;
uniform ivec3 u_degree_shape;
uniform ivec2 u_ids_shape;
uniform int u_scale_level;
uniform int u_real_height;
uniform int u_degree_key;
uniform int u_tile_fmt;
uniform int u_id_end;

uniform uint u8;

in vec2 uv;
out vec4 color;

const uint MAX = uint(16384) * uint(16384);
const uint bMAX = uint(ceil(log2(float(MAX))));

// Equality of vec4
bool equals4(uvec4 id1, uvec4 id2) {
  return all(equal(id1, id2));
}

// rgba to 32 bit int
uint unpack(uvec4 id) {
  return id.x + uint(256)*id.y + uint(65536)*id.z + uint(16777216)*id.w;
}

int roundi(float v) {
  return int(round(v));
}

vec2 toUV(vec2 center) {
  return round(center * u_corrections);
}

vec2 toLocalCenter(vec2 v) {
  vec2 small = v / float(u_scale_level);
  vec2 c = small - u_tile_origin * u_tile_size;
  return toUV(vec2(c.x, float(u_real_height) - c.y));
}

float division(uint ai, uint bi) {
  float a = float(ai);
  float b = float(bi);
  return (a / b);
}

float modulo(uint ai, uint bi) {
  float a = float(ai);
  float b = float(bi);
  return mod(a, b);
}

// Lookup 3D sampler
uint lookup_3d_idx(usampler2D sam, ivec3 shape, int idx_1d, int d) {
  // 3D indices for given index
  uint idx = uint(idx_1d * shape.z + d);
  uvec2 idx_max = uvec2(shape.x, shape.y);
  float idx_x = modulo(idx, idx_max.x) / float(idx_max.x);
  float idx_y = (0.5 + floor(division(idx, idx_max.x))) / float(idx_max.y);
  // Value for given index
  vec2 idx_2d = vec2(idx_x, 1.0 - idx_y);
  uvec4 m_value = texture(sam, idx_2d);
  return unpack(m_value);
}

// ID Lookup
uint lookup_ids_idx(uint idx) {
  // 2D indices for given index
  uvec2 ids_max = uvec2(u_ids_shape);
  float ids_idx_x = modulo(idx, ids_max.x) / float(ids_max.x);
  float ids_idx_y = (0.5 + floor(division(idx, ids_max.x))) / float(ids_max.y);
  // Value for given index
  vec2 ids_idx = vec2(ids_idx_x, 1.0 - ids_idx_y);
  uvec4 m_value = texture(u_ids, ids_idx);
  return unpack(m_value);
}

// Binary Search
int is_in_ids(uint ikey) {
  // Array size
  uint first = uint(0);
  uint last = uint(u_id_end);

  // No ID == 0
  if (ikey == uint(0)) {
    return -1;
  }

  // Search within log(n) runtime
  for (uint i = uint(0); i <= bMAX; i++) {
    // Evaluate the midpoint
    uint mid = (first + last) / uint(2);
    uint here = lookup_ids_idx(mid);

    // Break if list gone
    if (first == last && ikey != here) {
      break;
    }

    // Search below midpoint
    if (here > ikey) last = mid;

    // Search above midpoint
    else if (ikey > here) first = mid;

    // Found at midpoint
    else return int(mid);
  }
  // Not found
  return -1;
}

//
// calculate the color of sampler at an offset from position
//
uvec4 offset(usampler2D sam, vec2 pos, vec2 off) {
  // calculate the color of sampler at an offset from position
  float x_pos = pos.x + off.x/u_tile_size.x;
  float y_pos = pos.y + off.y/u_tile_size.y;
  return texture(sam, vec2(x_pos, y_pos));
}

int pow2(int v) {
  return v * v;
}

bool in_chart(int idx_1d) {
  uint minDegree = uint(u_tile_range[0]);
  if (u_degree_key > 0) {
    minDegree = lookup_3d_idx(u_degrees, u_degree_shape, idx_1d, u_degree_key - 1);
  }
  uint degreeDepth = uint(u_degree_shape.z);
  uint maxDegree = lookup_3d_idx(u_degrees, u_degree_shape, idx_1d, u_degree_key);
  uint center_iy = lookup_3d_idx(u_centers, u_center_shape, idx_1d, 1);
  uint center_ix = lookup_3d_idx(u_centers, u_center_shape, idx_1d, 0);
  vec2 center = toLocalCenter(vec2(center_ix, center_iy));

  // Testing
  //float ratio_y = (u_tile_size.y * uv.y) / center.y;
  //float ratio_x = (u_tile_size.x * uv.x) / center.x;

  int delta_y = roundi(u_tile_size.y * uv.y) - int(center.y);
  int delta_x = roundi(u_tile_size.x * uv.x) - int(center.x);
  float dx = 0.000001;
  float pi = 3.14159265;
  float radians = atan(float(delta_y), max(float(delta_x), dx)) + pi;
  uint degrees = uint(floor(180. * radians / pi));

  if (pow2(delta_y) + pow2(delta_x) > 15) {
    return false;
  }
  if (degrees > maxDegree) {
    return false;
  }
  if (degrees < minDegree) {
    return false;
  }
  return true;
}

// Check whether pixels are on cell border
bool in_edge(usampler2D sam, vec2 pos) {
  uvec4 empty_val = uvec4(0., 0., 0., 0.);
  uvec4 pixel = offset(sam, pos, vec2(0., 0.));
  bool background = equals4(empty_val, pixel);

  // If background
  if (background) {
    return false;
  }

  bool left = equals4(empty_val, offset(sam, pos, vec2(-1., 0.)));
  bool right = equals4(empty_val, offset(sam, pos, vec2(1., 0.)));
  bool down = equals4(empty_val, offset(sam, pos, vec2(0., -1.)));
  bool top = equals4(empty_val, offset(sam, pos, vec2(0., 1.)));

  // If not border
  if (!left && !right && !down && !top) {
    return false;
  }

  // Allow borders
  return true; 
}

int index_of_cell(usampler2D sam, vec2 pos) {
  uint id = unpack(offset(sam, uv, vec2(0., 0.)));
  return is_in_ids(id);
}

float range_clamp(float value) {

  float min_ = u_tile_range[0];
  float max_ = u_tile_range[1];
  
  return clamp((value - min_) / (max_ - min_), 0.0, 1.0);
}

vec4 u32_rgba_map(usampler2D sam, bvec2 mode) {
  vec4 empty_pixel = vec4(0., 0., 0., 0.);
  vec4 white_pixel = vec4(1., 1., 1., 1.);
  bool use_edge = mode.x;
  bool use_chart = mode.y;
  int idx_1d = index_of_cell(sam, uv);

  // Background
  if (idx_1d < 0) {
    return empty_pixel;
  }
  if (!use_edge && !use_chart) {
    return white_pixel;
  }
  bool is_edge = in_edge(sam, uv);
  if (use_edge && is_edge) {
    return white_pixel;
  }
  bool is_chart = in_chart(idx_1d);
  if (use_chart && is_chart) {
    return vec4(u_tile_color, 1.0);
  }
  return empty_pixel;
}

vec4 u16_rg_range(usampler2D sam) {
  uvec2 pixel = offset(sam, uv, vec2(0., 0.)).rg;
  float value = float(pixel.r * u8 + pixel.g) / 65535.;

  // Threshhold pixel within range
  float pixel_val = range_clamp(value);

  // Color pixel value
  vec3 pixel_color = u_tile_color * pixel_val;
  return vec4(pixel_color, 0.9);
}

void main() {
  if (u_tile_fmt == 32) {
    color = u32_rgba_map(u_tile, u_draw_mode);
  }
  else {
    color = u16_rg_range(u_tile);
  }
}
