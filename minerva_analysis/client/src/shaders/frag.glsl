#version 300 es
precision highp int;
precision highp float;
precision highp usampler2D;

uniform usampler2D u_tile;
uniform vec3 u_tile_color;
uniform vec2 u_tile_range;
uniform int u_tile_fmt;

uniform uint u8;

in vec2 uv;
out vec4 color;

// rgba to 32 bit int
uint unpack(uvec4 id) {
  return id.x + uint(256)*id.y + uint(65536)*id.z + uint(16777216)*id.w;
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

vec4 u32_rgba_map() {
  uvec4 pixel = texture(u_tile, uv);
  uint id = unpack(pixel);
  return colormap(id);
}

vec4 u16_rg_range() {
  uvec2 pixel = texture(u_tile, uv).rg;
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
    color = u32_rgba_map();
  }
  else {
    color = u16_rg_range();
  }
}