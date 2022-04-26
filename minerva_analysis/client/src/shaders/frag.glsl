#version 300 es
precision highp int;
precision highp float;
precision highp usampler2D;

uniform sampler2D u_gatings;
uniform sampler2D u_magnitudes;
uniform ivec2 u_gating_shape;
uniform ivec3 u_magnitude_shape;

uniform usampler2D u_centers;
uniform usampler2D u_tile;
uniform usampler2D u_ids;
uniform vec2 u_tile_size;
uniform vec3 u_tile_color;
uniform vec2 u_tile_range;
uniform vec2 u_tile_origin;
uniform vec2 u_corrections;
uniform bvec2 u_draw_mode;
uniform ivec3 u_center_shape;
uniform ivec2 u_ids_shape;
uniform int u_scale_level;
uniform int u_real_height;
uniform int u_tile_fmt;
uniform int u_id_end;

uniform uint u8;

in vec2 uv;
out vec4 color;

const uint MAX = uint(16384) * uint(16384);
const uint bMAX = uint(ceil(log2(float(MAX))));
const vec2 PI = vec2(-3.14159265, 3.14159265);

// Maximum number of channels
const int kMAX = 512;

// square given integer
int pow2(int v) {
  return v * v;
}

// rgba to one integer
uint unpack(uvec4 id) {
  return id.x + uint(256)*id.y + uint(65536)*id.z + uint(16777216)*id.w;
}

// Check if value between min and max
bool check_range(float value, vec2 range) {
  float clamped = clamp(value, range.x, range.y);
  return (abs(clamped - value) == 0.0);
}

// Interpolate between domain and range
float linear(vec2 y, int domain, int x) {
  float m = (y.y - y.x) / float(domain - 0); 
  return m * float(clamp(x, 0, domain)) + y[0];
}

// Float to rounded integer
int round_integer(float v) {
  return int(round(v));
}

// Tile to screen coordinates
vec2 toUV(vec2 center) {
  return round(center * u_corrections);
}

// Global to screen coordinates
vec2 toLocalCenter(vec2 v) {
  vec2 small = v / float(u_scale_level);
  vec2 c = small - u_tile_origin * u_tile_size;
  return toUV(vec2(c.x, float(u_real_height) - c.y));
}

// Float ratio of two integers
float division(uint ai, uint bi) {
  return float(ai) / float(bi);
}

// Float modulo of two integers
float modulo(uint ai, uint bi) {
  return mod(float(ai), float(bi));
}

// Turn 2D ratios to coordinates for 2D texture
vec2 to_texture_xy(vec2 s, float x, float y) {
  return vec2(x / s.x, 1.0 - (y + 0.5) / s.y);
}

// Turn 2D integers to coordinates for wrapped texture
// Note: needed for 2D textures larger than normal limits
vec2 to_flat_texture_xy(ivec3 shape, int cell_index, int d) {
  uint idx = uint(cell_index * shape.z + d);
  float idx_x = modulo(idx, uint(shape.x));
  float idx_y = floor(division(idx, uint(shape.x)));
  return to_texture_xy(vec2(shape.xy), idx_x, idx_y);
}

// Access cell center at cell index
vec2 sample_center(int cell_index) {
  ivec3 shape = u_center_shape;
  vec2 center_x = to_flat_texture_xy(shape, cell_index, 0);
  vec2 center_y = to_flat_texture_xy(shape, cell_index, 1);
  uint cx = unpack(texture(u_centers, center_x));
  uint cy = unpack(texture(u_centers, center_y));
  return vec2(cx, cy);
}

// Access marker key magnitude at cell index
float sample_magnitude(int cell_index, int key) {
  ivec3 shape = u_magnitude_shape;
  vec2 idx_2d = to_flat_texture_xy(shape, cell_index, key);
  return texture(u_magnitudes, idx_2d).r;
}

// Access marker key gating parameter
float sample_gating(float param, float key) {
  vec2 shape = vec2(u_gating_shape);
  vec2 idx_2d = to_texture_xy(shape, param, key);
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
bool match_angle(int count, int total, float rad) {
  float rad_min = linear(PI, total, count - 1);
  float rad_max = linear(PI, total, count);
  vec2 rad_range = vec2(rad_min, rad_max);
  return check_range(rad, rad_range);
}

// Access cell id at cell index
uint sample_id(uint idx) {
  vec2 shape = vec2(u_ids_shape);
  float idx_x = modulo(idx, uint(shape.x));
  float idx_y = floor(division(idx, uint(shape.x)));
  vec2 ids_idx = to_texture_xy(shape, idx_x, idx_y);
  uvec4 m_value = texture(u_ids, ids_idx);
  return unpack(m_value);
}

// Sample texture at given texel offset
uvec4 offset(usampler2D sam, vec2 size, vec2 pos, vec2 off) {
  float x_pos = pos.x + off.x / size.x;
  float y_pos = pos.y + off.y / size.y;
  return texture(sam, vec2(x_pos, y_pos));
}

// Sample index of cell at given offset
// Note: will be -1 if cell not in cell list
int sample_cell_index(vec2 off) {
  vec2 size = u_tile_size;
  // Find cell id at given offset 
  uint ikey = unpack(offset(u_tile, size, uv, off));

  // Array size
  uint first = uint(0);
  uint last = uint(u_id_end);

  // Return -1 if background
  if (ikey == uint(0)) {
    return -1;
  }

  // Search within log(n) runtime
  for (uint i = uint(0); i <= bMAX; i++) {
    // Evaluate the midpoint
    uint mid = (first + last) / uint(2);
    uint here = sample_id(mid);

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

// Limit to available marker keys
bool catch_key(int key) {
  if (key >= u_gating_shape.y) {
    return true;
  }
  if (key >= u_magnitude_shape.z) {
    return true;
  }
  return false;
}

// Count total OR-mode pie chart slices 
int count_gated_keys(int cell_index) {
  int gated_total = 0;
  for (int key = 0; key <= kMAX; key++) {
    if (catch_key(key)) {
      break;
    }
    float scale = sample_magnitude(cell_index, key);
    vec2 range = sample_gating_range(float(key));
    if (check_range(scale, range)) {
      gated_total = gated_total + 1;
    }
  }
  return gated_total;
}

// Colorize OR-mode pie chart slices 
vec4 to_chart_color(vec4 empty_pixel, int cell_index) {
  vec2 global_center = sample_center(cell_index);
  vec2 center = toLocalCenter(global_center);

  int delta_y = round_integer(u_tile_size.y * uv.y) - int(center.y);
  int delta_x = round_integer(u_tile_size.x * uv.x) - int(center.x);

  int max_r2 = pow2(4);
  if (pow2(delta_y) + pow2(delta_x) > max_r2) {
    return empty_pixel;
  }
  float dx = float(delta_x) + 0.0001;
  float rad = atan(float(delta_y), dx);

  int gated_count = 0;
  int gated_total = count_gated_keys(cell_index);

  // Check each possible key for color
  for (int key = 0; key <= kMAX; key++) {
    if (catch_key(key)) {
      break;
    }
    float scale = sample_magnitude(cell_index, key);
    vec2 range = sample_gating_range(float(key));
    if (check_range(scale, range)) {
      gated_count = gated_count + 1;
      if (match_angle(gated_count, gated_total, rad)) {
        vec3 color = sample_gating_color(float(key));
        return vec4(color, 1.0);
      }
    }
  }
  return empty_pixel;
}

// Check if pixel is on a border
bool near_cell_edge() {
  int cell_index = sample_cell_index(vec2(0, 0));
  for (int i = 0; i < 4; i++) {
    float ex = vec4(0, 0, 1, -1)[i];
    float ey = vec4(1, -1, 0, 0)[i];
    int edge_index = sample_cell_index(vec2(ex, ey));
    if (cell_index != edge_index) {
      return true;
    }
  }
  return false;
}

// Colorize discrete u32 signal
vec4 u32_rgba_map(bvec2 mode) {
  int cell_index = sample_cell_index(vec2(0, 0));
  vec4 empty_pixel = vec4(0., 0., 0., 0.);
  vec4 white_pixel = vec4(1., 1., 1., 1.);
  bool use_chart = mode.y;
  bool use_edge = mode.x;

  if(any(mode)) {
    // Charts (top layer)
    if (use_chart) {
      vec4 chart_color = to_chart_color(empty_pixel, cell_index);
      if (!all(equal(chart_color, empty_pixel))) {
        return chart_color;
      }
    }
    // Borders (bottom layer)
    if (use_edge) {
      if (near_cell_edge()) {
        return white_pixel;
      }
      return empty_pixel;
    }
  }
  else {
    // Fill (bottom layer)
    if (cell_index > -1) {
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
  vec2 size = u_tile_size;
  uvec2 pixel = offset(u_tile, size, uv, vec2(0, 0)).rg;
  float value = float(pixel.r * u8 + pixel.g) / 65535.;

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
