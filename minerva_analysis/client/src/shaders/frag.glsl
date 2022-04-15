#version 300 es
precision highp int;
precision highp float;
precision highp usampler2D;

uniform usampler2D u_tile;
uniform vec3 u_tile_size;
uniform vec3 u_tile_color;
uniform vec2 u_tile_range;
uniform int u_draw_mode;
uniform int u_tile_fmt;

uniform uint u8;

in vec2 uv;
out vec4 color;

// Equality of vec4
bool equals4(uvec4 id1, uvec4 id2) {
  return all(equal(id1, id2));
}

// rgba to 32 bit int
uint unpack(uvec4 id) {
  return id.x + uint(256)*id.y + uint(65536)*id.z + uint(16777216)*id.w;
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

//
// Check whether nearby positions are the same
//
uvec4 borders(usampler2D sam, vec2 pos) {
  // calculate the color of sampler at an offset from position
  uvec4 here_id = offset(sam,pos,vec2(0., 0.));

  bool left = equals4(here_id, offset(sam,pos,vec2(-1., 0.)));
  bool right = equals4(here_id, offset(sam,pos,vec2(1., 0.)));
  bool down = equals4(here_id, offset(sam,pos,vec2(0., -1.)));
  bool top = equals4(here_id, offset(sam,pos,vec2(0., 1.)));

  // If any are false, return false
  if (!left || !right || !down || !top) {
    return uvec4(0.,0.,0.,1.);
  }
  return here_id;
}

vec4 hsv2rgb(vec3 c, float a) {
  vec4 K = vec4(1., 2./3., 1./3., 3.);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6. - K.www);
  vec3 done = c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y);
  return vec4(done,a);
}

vec3 spike(float id) {
  vec3 star = pow(vec3(3,7,2),vec3(-1)) + pow(vec3(10),vec3(-2,-3,-2));
  vec3 step = fract(id*star);
  step.z = mix(0.2,0.9,step.z);
  step.y = mix(0.6,1.0,step.y);
  return step;
}

vec4 colormap (uint id) {
  vec3 hsv = spike(float(id));
  float alpha = 1.;
  if (id == uint(0)) {
    hsv = vec3(0.0, 0.0, 0.0);
    alpha = 0.; 
  }
  else if (id == uint(1)) {
    return vec4(u_tile_color, alpha);
  }
  return hsv2rgb(hsv, alpha);
}

uvec4 draw_pixel(usampler2D sam, int mode) {
  if (mode == 1) {
  }
  // Default render mode
  return offset(sam, uv, vec2(0., 0.));
}

vec4 u32_rgba_map(usampler2D sam, int mode) {
  uvec4 pixel = draw_pixel(sam, mode);
  uint id = unpack(pixel);
  return colormap(id);
}

vec4 u16_rg_range(usampler2D sam, int mode) {
  uvec2 pixel = draw_pixel(sam, mode).rg;
  float value = float(pixel.r * u8 + pixel.g) / 65535.;

  float min_ = u_tile_range[0];
  float max_ = u_tile_range[1];

  // Threshhold pixel within range
  float pixel_val = clamp((value - min_) / (max_ - min_), 0.0, 1.0);

  // Color pixel value
  vec3 pixel_color = pixel_val * u_tile_color;
  return vec4(pixel_color, 1.0);
}

void main() {
  if (u_tile_fmt == 32) {
    color = u32_rgba_map(u_tile, u_draw_mode);
  }
  else {
    color = u16_rg_range(u_tile, u_draw_mode);
  }
}
