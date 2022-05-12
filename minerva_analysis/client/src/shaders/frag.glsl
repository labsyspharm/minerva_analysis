#version 300 es
precision highp int;
precision highp float;
precision highp usampler2D;

uniform usampler2D u_ids;
uniform usampler2D u_tile;
uniform sampler2D u_gatings;
uniform sampler2D u_centers;
uniform sampler2D u_mag_0;
uniform sampler2D u_mag_1;
uniform sampler2D u_mag_2;
uniform sampler2D u_mag_3;
uniform ivec2 u_ids_shape;
uniform vec2 u_tile_shape;
uniform ivec2 u_gating_shape;
uniform ivec3 u_center_shape;
uniform ivec2 u_magnitude_shape;
uniform ivec4 u_marker_sample;

uniform float u_tile_fraction;
uniform float u_tile_scale;
uniform float u_pie_radius;
uniform vec2 u_tile_origin;
uniform vec2 u_tile_range;
uniform vec3 u_tile_color;
uniform bvec2 u_draw_mode;
uniform vec2 u_x_bounds;
uniform vec2 u_y_bounds;
uniform int u_tile_fmt;
uniform int u_picked_id;
uniform int u_id_end;

in vec2 uv;
out vec4 color;

// Fixed maximum number of ids
const uint MAX = uint(16384) * uint(16384);
const uint bMAX = uint(ceil(log2(float(MAX))));
// Fixed range of radians
const vec2 TAU = vec2(0., 6.2831853);
const float PI = 3.14159265;
// Fixed maximum number of channels
const int kMAX = 4;

// square given float
float pow2(float v) {
  return v * v;
}

// difference
float dx(vec2 v) {
  return v[1] - v[0];
}

// rgba to one integer
uint unpack(uvec4 id) {
  return id.x + uint(256)*id.y + uint(65536)*id.z + uint(16777216)*id.w;
}

// Check if value between min and max
bool check_range(float value, vec2 range) {
  return value >= range.x && value < range.y;
}

// Interpolate between domain and range
float linear(vec2 ran, float dom, float x) {
  float b = ran[0];
  float m = dx(ran) / dom; 
  return m * float(clamp(x, 0., dom)) + b;
}

// From screen to local tile coordinates
vec2 screen_to_tile(vec2 screen) {
  float x = linear(u_x_bounds, 1., screen.x);
  float y = linear(u_y_bounds, 1., screen.y);
  return vec2(x, y) * u_tile_shape;
}

// From global to local tile coordinates
vec2 global_to_tile(vec2 v) {
  vec2 c = v / u_tile_scale - u_tile_origin;
  return vec2(c.x, u_tile_shape.y - c.y);
}

// Check if values in array match
bool check_same(uvec4 arr, ivec2 ii) {
  if (arr[ii.x] == arr[ii.y]) return true;
  return false;
}
bool check_same(uvec4 arr, ivec3 ii) {
  if (arr[ii.x] == arr[ii.y]) return true;
  if (arr[ii.y] == arr[ii.z]) return true;
  if (arr[ii.x] == arr[ii.z]) return true;
  return false;
}

// Float ratio of two integers
float division(int ai, int bi) {
  return float(ai) / float(bi);
}

// Float modulo of two integers
float modulo(uint ai, uint bi) {
  return mod(float(ai), float(bi));
}

// Turn 2D ratios to coordinates for 2D texture
vec2 to_texture_xy(vec2 s, float x, float y) {
  return vec2((x + 0.5) / s.x, 1.0 - (y + 0.5) / s.y);
}

// Turn 2D integers to coordinates for wrapped texture
// Note: needed for 2D textures larger than normal limits
vec2 to_flat_texture_xy(ivec3 size, int cell_index, int d) {
  uint idx = uint(cell_index * size.z + d);
  float idx_x = modulo(idx, uint(size.x));
  float idx_y = floor(division(int(idx), size.x));
  return to_texture_xy(vec2(size.xy), idx_x, idx_y);
}

// Access cell center at cell index
vec2 sample_center(int cell_index) {
  ivec3 size = u_center_shape;
  vec2 center_x = to_flat_texture_xy(size, cell_index, 0);
  vec2 center_y = to_flat_texture_xy(size, cell_index, 1);
  float cx = texture(u_centers, center_x).r;
  float cy = texture(u_centers, center_y).r;
  return vec2(cx, cy);
}

// Access marker key magnitude at cell index
float sample_magnitude(int cell_index, int key) {
  ivec3 size = ivec3(u_magnitude_shape, 1);
  vec2 idx_2d = to_flat_texture_xy(size, cell_index, 0);
  // Use any of available samplers
  if (u_marker_sample[0] == key) {
    return texture(u_mag_0, idx_2d).r;
  }
  else if (u_marker_sample[1] == key) {
    return texture(u_mag_1, idx_2d).r;
  }
  else if (u_marker_sample[2] == key) {
    return texture(u_mag_2, idx_2d).r;
  }
  else if (u_marker_sample[3] == key) {
    return texture(u_mag_3, idx_2d).r;
  }
  else {
    return -1.;
  }
}

// Access marker key gating parameter
float sample_gating(float param, float key) {
  vec2 size = vec2(u_gating_shape);
  vec2 idx_2d = to_texture_xy(size, param, key);
  return texture(u_gatings, idx_2d).r;
}

// Access marker key gated min/max
vec2 sample_gating_range(float key) {
  float min_range = sample_gating(0., key);
  float max_range = sample_gating(1., key);
  return vec2(min_range, max_range);
}

// Access marker key gated color
vec3 sample_gating_color(float key) {
  float r = sample_gating(2., key);
  float g = sample_gating(3., key);
  float b = sample_gating(4., key);
  return vec3(r, g, b);
}

// Check if angle is within one evenly divided slice
bool match_angle(int count, int total, float angle) {
  float rad_min = linear(TAU, float(total), float(count) - 1.);
  float rad_max = linear(TAU, float(total), float(count));
  vec2 rad_range = vec2(rad_min, rad_max);
  return check_range(angle, rad_range);
}

// Access cell id at cell index
uint sample_id(usampler2D sam, ivec2 size, uint idx) {
  float idx_x = modulo(idx, uint(size.x));
  float idx_y = floor(division(int(idx), int(size.x)));
  vec2 ids_idx = to_texture_xy(vec2(size), idx_x, idx_y);
  uvec4 m_value = texture(sam, ids_idx);
  return unpack(m_value);
}

// Sample texture at given texel offset
uvec4 offset(usampler2D sam, vec2 size, vec2 pos, vec2 off) {
  float x_pos = pos.x + off.x / size.x;
  float y_pos = pos.y + off.y / size.y;
  float x = linear(u_x_bounds, 1., x_pos);
  float y = linear(u_y_bounds, 1., y_pos);
  return texture(sam, vec2(x, y));
}

// Generic binary search of ids
int binary_search(usampler2D sam, ivec2 size, uint last, uint ikey) {
  uint first = uint(0);
  // Search within log(n) runtime
  for (uint i = uint(0); i <= bMAX; i++) {
    // Evaluate the midpoint
    uint mid = (first + last) / uint(2);
    uint here = sample_id(sam, size, mid);

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
  // Return -1 if id not in list
  return -1;
}

// Sample index of cell at given offset
// Note: will be -1 if cell not in cell list
int sample_cell_index(vec2 off) {
  // Find cell id at given offset 
  uint ikey = unpack(offset(u_tile, u_tile_shape, uv, off));

  // Array size
  // Return -1 if background
  if (ikey == uint(0)) {
    return -1;
  }

  // Use externally picked id
  if (u_picked_id < 0 || u_picked_id == int(ikey)) {
    // Return index in main id list
    return binary_search(u_ids, u_ids_shape, uint(u_id_end), ikey);
  }
  return -1;
}

// Limit to available marker keys
bool catch_key(int key) {
  if (key >= u_gating_shape.y) {
    return true;
  }
  return false;
}

// Count total OR-mode pie chart slices 
int count_gated_keys(int cell_index) {
  int gated_total = 0;
  for (int key = 0; key <= kMAX; key++) {
    if (catch_key(key)) {
      return gated_total;
    }
    float scale = sample_magnitude(cell_index, key);
    vec2 range = sample_gating_range(float(key));
    if (check_range(scale, range)) {
      gated_total = gated_total + 1;
    }
  }
  return gated_total;
}

float dist (vec2 v) {
  return sqrt(pow2(v.x) + pow2(v.y));
}

// Match channel to cell index
int to_and_gate(int cell_index) {
  // Check each possible key for color
  for (int key = 0; key <= kMAX; key++) {
    if (catch_key(key)) {
      return 0;
    }
    float scale = sample_magnitude(cell_index, key);
    vec2 range = sample_gating_range(float(key));
    if (scale >= 0. && !check_range(scale, range)) {
      return -1;
    }
  }
  return 0;
}

// Return angle within pie chart
float to_chart_angle(int cell_index, float radius) {
  if (cell_index < 0) {
    return -1.;
  }
  float pie_radius = radius * u_tile_fraction;
  vec2 global_center = sample_center(cell_index);
  vec2 center = global_to_tile(global_center);
  vec2 pos = screen_to_tile(uv);
  vec2 delta = pos - center;

  if (dist(delta) > pie_radius) {
    return -1.;
  }
  float rad = atan(delta.y, delta.x);
  float angle = mod(rad + PI, TAU.y);
  return angle;
}

// Match channel to cell index
int to_or_gate(int cell_index, float radius) {
  float angle = 0.0;
  int gated_count = 0;
  int gated_total = count_gated_keys(cell_index);
  // Outside of circle
  if (radius > 0.0) {
    angle = to_chart_angle(cell_index, radius);
    if (angle < 0.0) {
      return -1;
    }
  }
  // Check each possible key for color
  for (int key = 0; key <= kMAX; key++) {
    if (catch_key(key)) {
      return -1;
    }
    float scale = sample_magnitude(cell_index, key);
    vec2 range = sample_gating_range(float(key));
    if (check_range(scale, range)) {
      gated_count = gated_count + 1;
      if (radius <= 0.0) {
        return key;
      }
      if (match_angle(gated_count, gated_total, angle)) {
        return key;
      }
    }
  }
}

// Match channel to cell index
int to_gate(int cell_index, bvec2 mode, float radius) {
  int n_gates = u_gating_shape.y;
  if (n_gates < 1 || cell_index < 0) {
    return -1;
  }
  bool or_mode = mode.y;
  if (or_mode) {
    return to_or_gate(cell_index, radius);
  }
  else {
    return to_and_gate(cell_index);
  }
}

// Sample gating state of cell at given offset
int sample_cell_gate(vec2 off, bvec2 mode, float radius) {
  int cell_index = sample_cell_index(off);
  return to_gate(cell_index, mode, radius);
}

bool in_diff(usampler2D sam, vec2 pos, float one, bvec2 mode) {
  int cell_idx = sample_cell_gate(vec2(0., 0.), mode, -1.0);
  bool left_black = sample_cell_gate(vec2(-1. * one, 0.), mode, -1.0) != cell_idx;
  bool right_black = sample_cell_gate(vec2(1. * one, 0.), mode, -1.0) != cell_idx;
  bool down_black = sample_cell_gate(vec2(0., -1. * one), mode, -1.0) != cell_idx;
  bool top_black = sample_cell_gate(vec2(0., 1. * one), mode, -1.0) != cell_idx;

  if (left_black || right_black || down_black || top_black) {
    return true;
  }
  return false;
}

bool equals4(uvec4 id1, uvec4 id2) {
  return all(equal(id1, id2));
}

// Check if pixel is on a border
bool near_cell_edge(float one, bvec2 mode) {
  uvec4 empty_val = uvec4(0., 0., 0., 0.);
  int cell_index = sample_cell_index(vec2(0, 0));
  uvec4 pixel = offset(u_tile, u_tile_shape, uv, vec2(0., 0.));
  bool background = equals4(empty_val, pixel);

  // Background not counted
  if (one == 1.0 && background) {
    return false;
  }
  // Cells not counted
  else if (one > 1.0 && !background) {
    return false;
  }
  // pixels are at different cells
  else if (in_diff(u_tile, uv, one, mode)) {
    return true;
  }
  // Not an edge 
  return false; 
}

// Colorize discrete u32 signal
vec4 u32_rgba_map(bvec2 mode) {
  int key = sample_cell_gate(vec2(0, 0), mode, u_pie_radius);
  vec4 empty_pixel = vec4(0., 0., 0., 0.);
  vec4 white_pixel = vec4(1., 1., 1., 1.);
  bool edge_mode = mode.x;
  bool or_mode = mode.y;
  if (key > -1) {
    if (or_mode) {
      return vec4(sample_gating_color(float(key)), 1.0);
    }
    else if (!edge_mode) {
      return white_pixel;
    }
  }

  // Borders (bottom layer)
  if (edge_mode) {
    float one = 1.0 / u_tile_fraction;
    if (near_cell_edge(one, mode)) {
      return white_pixel;
    }
  }
  // Background
  return empty_pixel;
}

// Clamp signal between given min/max
float range_clamp(float value) {
  float min_ = u_tile_range[0];
  float max_ = u_tile_range[1];
  return clamp((value - min_) / (max_ - min_), 0.0, 1.0);
}

// Colorize continuous u16 signal
vec4 u16_rg_range(float alpha) {
  uvec2 pixel = offset(u_tile, u_tile_shape, uv, vec2(0, 0)).rg;
  float value = float(pixel.r * uint(255) + pixel.g) / 65535.;

  // Threshhold pixel within range
  float pixel_val = range_clamp(value);

  // Color pixel value
  vec3 pixel_color = u_tile_color * pixel_val;
  return vec4(pixel_color, alpha);
}

//
// Entrypoint
//

void main() {
  if (u_tile_fmt == 32) {
    color = u32_rgba_map(u_draw_mode);
  }
  else {
    color = u16_rg_range(0.9);
  }
}
