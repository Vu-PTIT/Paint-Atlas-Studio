const canvas = document.getElementById('view');
const loading = document.getElementById('loading');
const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
if (!gl) {
  loading.innerHTML = '<p>Cảnh cần trình duyệt hỗ trợ WebGL2.</p>';
  throw new Error('WebGL2 unavailable');
}

const PI = Math.PI, TAU = PI * 2;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = n => n - Math.floor(n);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (p, n) => [p[0] * n, p[1] * n, p[2] * n];
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const UP = [0, 1, 0], X = [1, 0, 0], Z = [0, 0, 1];

function seeded(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
let rand = seeded(162894);
const spread = (amount = 1) => (rand() - .5) * amount;
const ink = rgb => [rgb >> 16 & 255, rgb >> 8 & 255, rgb & 255];
const pair = (shade, light) => [ink(shade), ink(light)];
const tint = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const paletteMix = (a,b,t) => [tint(a[0],b[0],t),tint(a[1],b[1],t)];
const pick = arr => arr[Math.floor(rand() * arr.length)];

function cat(a, b, c, d, t) {
  return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}
function matrix() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3];
  }
  return out;
}
function rotate(x, y, z) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return new Float32Array([
    cy * cz, sx * sy * cz + cx * sz, sx * sz - cx * sy * cz, 0,
    -cy * sz, cx * cz - sx * sy * sz, sx * cz + cx * sy * sz, 0,
    sy, -sx * cy, cx * cy, 0,
    0, 0, 0, 1
  ]);
}
function around(pivot, x, y, z, move = [0, 0, 0]) {
  const m = rotate(x, y, z);
  for (let i = 0; i < 3; i++) m[12 + i] = pivot[i] + move[i] - (m[i] * pivot[0] + m[4 + i] * pivot[1] + m[8 + i] * pivot[2]);
  return m;
}
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy * .5), inv = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * inv, -1, 0, 0, 2 * far * near * inv, 0]);
}
function lookAt(eye, target) {
  const z = unit(sub(eye, target)), x = unit(cross(UP, z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

const TEXTURE = 0, BASE = 1, SKY = 2, SKY_BASE = 3, LIGHT = 4, WATER = 5, FALL = 6, GRASS = 7, OBJECT = 8, GLOW = 9, PETAL = 10;
const STRIDE = 52, MAX_BONES = 30;
const uniforms = {};
const vertexSource = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aAlong;
layout(location=2) in vec3 aAcross;
layout(location=3) in float aSeed;
layout(location=4) in vec4 aLow;
layout(location=5) in vec4 aHigh;
layout(location=6) in uvec4 aMeta;
uniform mat4 uVP, uBones[${MAX_BONES}];
uniform vec3 uEye, uLamp, uReflections[5];
uniform float uTime, uDensity, uMoonVisible;
uniform vec3 uFog;
uniform bool uRig;
out vec2 vUV;
flat out vec3 vColor;
flat out float vSeed, vAlpha;
flat out uint vStyle;

void main() {
  vec3 p = aPosition, along = aAlong, across = aAcross;
  uint style = aMeta.y;
  if (uRig) {
    mat4 bone = uBones[int(aMeta.x)];
    p = (bone * vec4(p, 1.)).xyz;
    along = mat3(bone) * along;
    across = mat3(bone) * across;
  }
  float d = distance(p, uEye);
  float fade = 1., grow = 1.;
  if (style == 0u || style == 7u || style == 8u || style == 10u || style == 5u || style == 6u) {
    float detail = smoothstep(13., 115., d);
    bool fine = style == 0u || style == 7u;
    float retain = mix(1.045, fine ? .20 : .45, detail) - (1. - uDensity) * (fine ? .81 : .54);
    fade = 1. - smoothstep(retain - .095, retain + .055, aSeed);
    grow = mix(1., fine ? 1.77 : 1.38, detail) * mix(.45, 1., fade);
    if (style == 7u) fade *= 1. - smoothstep(18., 28., d);
    if (style == 0u) fade *= 1. - smoothstep(148., 205., d);
  } else if (style == 2u) {
    float retain = .998 - (1. - uDensity) * .70;
    fade = 1. - smoothstep(retain - .04, retain + .065, aSeed);
    grow = mix(.62, 1., fade);
  }
  if (fade < .013) {
    gl_Position = vec4(3., 3., 3., 1.);
    return;
  }
  float flow = sin(p.x * .98 + p.z * .68 - uTime * 2.5 + aSeed * 8.);
  vec3 normal = normalize(cross(along, across));
  vec3 color;
  if (style == 2u || style == 3u || style == 4u || style == 9u) {
    color = mix(aLow.rgb, aHigh.rgb, .41 + .43 * aSeed);
    if (style == 4u && uRig) color *= 1.02 + .05 * sin(uTime * 7.8);
  } else {
    float lamp = max(0., 1. - distance(p, uLamp) / 7.1);
    float pool = lamp * lamp * 1.42;
    if (uRig && aMeta.x < 21u) pool *= aMeta.x >= 17u ? .14 : .56;
    float warm = min(1., float(aMeta.z) / 255. + pool);
    float light = clamp(.26 + .70 * max(0., dot(normal, vec3(.48, .67, -.56))) + .58 * warm, .04, 1.);
    color = mix(aLow.rgb, aHigh.rgb, light);
    float value = dot(color, vec3(.29, .53, .18));
    vec3 moon = mix(vec3(value), color, .87) * vec3(.84, .99, 1.15);
    color = mix(moon, color * vec3(1.39, 1.13, .74) + vec3(.059, .021, .002), warm);
    float fog = .47 * smoothstep(34., 188., d);
    color = mix(color, uFog, fog);
    if (style == 5u) {
      p.x += .18 * flow;
      p.y += .014 * flow;
      color *= .95 + .17 * flow;
      vec3 view = normalize(uEye - p);
      vec3 reflected = vec3(-view.x, view.y, -view.z);
      float moonGlint = smoothstep(.92, .998, dot(reflected, vec3(.339, .247, -.909)));
      float windows = 0.;
      for (int i = 0; i < 5; ++i) {
        vec3 towardSource = uReflections[i] - p;
        float distanceToSource = length(towardSource);
        float aligned = dot(reflected, towardSource / max(.01, distanceToSource));
        windows = max(windows, smoothstep(.968, .998, aligned) * (1. - smoothstep(13., 48., distanceToSource)));
      }
      float ripple = smoothstep(.12, .93, aSeed + .21 * flow);
      color += (vec3(.31, .201, .078) * moonGlint * uMoonVisible + vec3(.49, .295, .080) * windows) * ripple;
    }
    if (style == 6u) {
      p.y -= .22 * sin(uTime * 4.5 + p.y * .84 + aSeed * 7.);
      color *= .95 + .20 * sin(uTime * 5. + p.y * .77 + aSeed * 3.);
    }
    if (style == 7u || style == 10u) p.x += .032 * flow;
  }
  float pigment = .88 + aSeed * .24;
  vColor = max(vec3(0.), color * pigment);
  vSeed = aSeed;
  vStyle = style;
  vUV = vec2((gl_VertexID & 1) == 0 ? -1. : 1., gl_VertexID < 2 ? -1. : 1.);
  vAlpha = aLow.a * fade;
  vec3 motion = (style == 7u || style == 10u) ? vec3(.061 * flow * vUV.x, 0., .023 * flow * vUV.x) : vec3(0.);
  gl_Position = uVP * vec4(p + grow * (along * vUV.x + across * vUV.y) + motion, 1.);
}`;

const fragmentSource = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
flat in vec3 vColor;
flat in float vSeed, vAlpha;
flat in uint vStyle;
out vec4 outColor;
const float BRISTLES = 13.;
void main() {
  float u = vUV.x, v = vUV.y;
  if (vStyle == 9u) {
    float d = dot(vUV, vUV);
    float a = max(0., 1. - d);
    outColor = vec4(vColor, a * a * a * vAlpha);
    return;
  }
  float brush = sin(u * 4.1 + 8. * vSeed);
  float axis = v + .10 * brush * (1. - abs(u));
  float phase = (axis + 1.) * BRISTLES * 3.14159265 + .48 * brush + vSeed * 9.;
  float alias = 1. - smoothstep(.45, 2.9, fwidth(phase));
  float ridge = cos(phase) * alias, flank = sin(phase) * alias;
  bool foundation = vStyle == 1u || vStyle == 3u;
  float taper = (foundation ? .91 : .85) - (foundation ? .08 : .25) * u * u;
  float tip = abs(u + .021 * sin(v * 41. + vSeed * 11.)) - .963 - .039 * ridge;
  float border = max(abs(axis) - taper + .052 * ridge, tip);
  float aa = clamp(fwidth(border) * .60, .021, .18);
  float opacity = (1. - smoothstep(-aa, aa, border)) * vAlpha;
  // Keep a filled bed of pigment beneath the finer, translucent strokes.
  if (opacity < (foundation ? .39 : .14)) discard;
  if (foundation) opacity = mix(.81, 1., smoothstep(.39, .90, opacity));
  float tooth = sin((v + .1 * sin(u * 46.)) * 132. + u * 57. + vSeed * 31.);
  float toothWeight = 1. - smoothstep(.6, 3., fwidth(u * 57. + v * 132.));
  float height = .95 + ridge * .077 + flank * .052 + ridge * ridge * .083 + tooth * toothWeight * .027;
  float roll = .96 + .079 * (1. - v * v) + .035 * sin(u * 5. + vSeed * 23.);
  vec3 ink = vColor * height * roll + max(flank, 0.) * (foundation ? .012 : .028) * vec3(.64, .82, 1.);
  outColor = vec4(ink, opacity);
}`;

function shader(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
for (const name of ['uVP', 'uBones[0]', 'uEye', 'uLamp', 'uReflections[0]', 'uTime', 'uDensity', 'uMoonVisible', 'uFog', 'uRig']) uniforms[name] = gl.getUniformLocation(program, name);

const sources = [];
function warmAt(x, y, z) {
  let warm = 0;
  for (const [lx, ly, lz, r, strength] of sources) {
    const d2 = (x - lx) ** 2 + (y - ly) ** 2 + (z - lz) ** 2;
    if (d2 < r * r) warm = Math.max(warm, (1 - Math.sqrt(d2) / r) * strength);
  }
  return warm;
}

let drawCount = 0, bakedStrokes = 0;
class BrushBuffer {
  constructor(capacity = 1024) {
    this.count = 0;
    this.minimum = [Infinity, Infinity, Infinity];
    this.maximum = [-Infinity, -Infinity, -Infinity];
    this.allocate(capacity);
  }
  allocate(capacity) {
    const previous = this.bytes;
    this.bytes = new Uint8Array(capacity * STRIDE);
    if (previous) this.bytes.set(previous);
    this.floats = new Float32Array(this.bytes.buffer);
  }
  paint(x, y, z, ax, ay, az, bx, by, bz, colors, style, alpha, bone, warmth) {
    if ((this.count + 1) * STRIDE > this.bytes.length) this.allocate((this.bytes.length / STRIDE) * 2);
    const f = this.count * (STRIDE / 4), b = this.count++ * STRIDE;
    const floats = this.floats, bytes = this.bytes;
    floats[f] = x; floats[f + 1] = y; floats[f + 2] = z;
    floats[f + 3] = ax; floats[f + 4] = ay; floats[f + 5] = az;
    floats[f + 6] = bx; floats[f + 7] = by; floats[f + 8] = bz; floats[f + 9] = rand();
    bytes.set(colors[0], b + 40); bytes[b + 43] = alpha * 255;
    bytes.set(colors[1], b + 44);
    bytes[b + 48] = bone; bytes[b + 49] = style;
    bytes[b + 50] = clamp(warmth ?? (style === SKY || style === SKY_BASE || style === LIGHT || style === GLOW ? 0 : warmAt(x, y, z))) * 255;
    const pad = (Math.hypot(ax, ay, az) + Math.hypot(bx, by, bz)) * 1.8;
    this.minimum[0] = Math.min(this.minimum[0], x - pad);
    this.minimum[1] = Math.min(this.minimum[1], y - pad);
    this.minimum[2] = Math.min(this.minimum[2], z - pad);
    this.maximum[0] = Math.max(this.maximum[0], x + pad);
    this.maximum[1] = Math.max(this.maximum[1], y + pad);
    this.maximum[2] = Math.max(this.maximum[2], z + pad);
  }
  upload() {
    if (!this.count) return this;
    this.center = lerp3(this.minimum, this.maximum, .5);
    this.radius = Math.hypot(...sub(this.maximum, this.center));
    this.vao = gl.createVertexArray();
    this.buffer = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.bytes.subarray(0, this.count * STRIDE), gl.STATIC_DRAW);
    for (let i = 0; i < 7; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribDivisor(i, 1);
    }
    for (let i = 0; i < 3; i++) gl.vertexAttribPointer(i, 3, gl.FLOAT, false, STRIDE, i * 12);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE, 36);
    gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, STRIDE, 40);
    gl.vertexAttribPointer(5, 4, gl.UNSIGNED_BYTE, true, STRIDE, 44);
    gl.vertexAttribIPointer(6, 4, gl.UNSIGNED_BYTE, STRIDE, 48);
    this.floats = this.bytes = null;
    return this;
  }
  draw() {
    if (!this.count) return;
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    drawCount += this.count;
  }
  dispose() {
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.buffer);
  }
}

class TerrainBrushes {
  constructor(size = 16) {
    this.cells = new Map();
    this.size = size;
  }
  paint(x, y, z, ...rest) {
    const key = Math.floor(x / this.size) + ',' + Math.floor(z / this.size);
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, cell = new BrushBuffer());
    cell.paint(x, y, z, ...rest);
  }
  upload() {
    for (const b of this.cells.values()) {
      b.upload();
      bakedStrokes += b.count;
    }
  }
  draw(planes) {
    for (const b of this.cells.values()) if (visible(b, planes)) b.draw();
  }
}
const land = new TerrainBrushes();
const architecture = new TerrainBrushes(20);
const mountainBrushes = new TerrainBrushes(31);

function dab(batch, p, n, tangent, length, width, colors, style = OBJECT, alpha = 1, bone = 0, warm) {
  let side = cross(n, tangent);
  if (dot(side, side) < 1e-7) side = cross(n, Math.abs(n[0]) < .8 ? X : Z);
  side = unit(side);
  const along = unit(cross(side, n));
  // These are half-extents. All mark types use bounded, aspect-aware dimensions.
  length = clamp(length, .009, 30);
  width = clamp(width, .006, 26);
  batch.paint(p[0], p[1], p[2], along[0] * length, along[1] * length, along[2] * length,
    side[0] * width, side[1] * width, side[2] * width, colors, style, alpha, bone, warm);
}
function flatDab(batch, x, y, z, angle, length, width, colors, style = TEXTURE, alpha = 1, warm) {
  const c = Math.cos(angle), s = Math.sin(angle);
  batch.paint(x, y, z, c * length, 0, s * length, s * width, 0, -c * width, colors, style, alpha, 0, warm);
}
function visible(batch, planes) {
  const [x, y, z] = batch.center;
  return planes.every(p => p[0] * x + p[1] * y + p[2] * z + p[3] >= -batch.radius);
}
function frustum(m) {
  const planes = [];
  for (let j = 0; j < 3; j++) for (const sign of [-1, 1]) {
    const p = [m[3] + sign * m[j], m[7] + sign * m[j + 4], m[11] + sign * m[j + 8], m[15] + sign * m[j + 12]];
    const norm = Math.hypot(p[0], p[1], p[2]);
    planes.push(p.map(n => n / norm));
  }
  return planes;
}

function ellipsoid(batch, center, radius, colors, options = {}) {
  const [rx, ry, rz] = radius;
  const detail = options.detail ?? 178;
  const samples = Math.max(options.minimum ?? 32, Math.ceil(4 * PI * (rx * ry + ry * rz + rx * rz) / 3 * detail));
  const spacing = Math.sqrt((4 * PI * (rx * ry + ry * rz + rx * rz) / 3) / samples);
  for (let i = 0; i < samples; i++) {
    const h = (i + rand()) / samples * 2 - 1, a = i * 2.399963 + spread(.13), r = Math.sqrt(1 - h * h);
    const ux = r * Math.cos(a), uz = r * Math.sin(a);
    const n = unit([ux / rx, h / ry, uz / rz]);
    const puff = options.rough ? 1 + options.rough * spread(.8) : 1;
    const p = [center[0] + ux * rx * puff, center[1] + h * ry * puff, center[2] + uz * rz * puff];
    const color = typeof colors === 'function' ? colors(ux, h, uz, i) : colors;
    dab(batch, p, n, options.dir ?? [1, .4, .22], spacing * (1.06 + rand() * .65), spacing * (.56 + rand() * .37),
      color, options.style ?? OBJECT, options.alpha ?? 1, options.bone ?? 0, options.warm);
  }
}
function tube(batch, a, b, r0, r1, colors, options = {}) {
  const v = sub(b, a), length = Math.hypot(...v);
  const f = unit(v), g = unit(cross(f, Math.abs(f[1]) < .85 ? UP : X)), h = cross(f, g);
  const aroundCount = options.sides ?? clamp(Math.ceil(Math.max(r0, r1) * 48), 7, 36);
  const steps = Math.max(2, Math.ceil(length / (options.step ?? .11)));
  const direction = (options.band ? g : f);
  for (let j = 0; j <= steps; j++) {
    const t = j / steps, radius = mix(r0, r1, t);
    for (let i = 0; i < aroundCount; i++) {
      const theta = (i + (j & 1) * .5 + spread(.36)) / aroundCount * TAU;
      const n = add(scale(g, Math.cos(theta)), scale(h, Math.sin(theta)));
      const pos = add(lerp3(a, b, clamp(t + spread(.7 / steps))), scale(n, radius * (1 + spread(options.rough ?? .09))));
      const forward = options.band ? cross(f, n) : direction;
      const along = Math.max(length / steps, .021);
      const width = Math.max(radius * TAU / aroundCount, .014);
      const color = typeof colors === 'function' ? colors(t, theta) : colors;
      dab(batch, pos, n, forward, (options.band ? width : along) * (1.03 + rand() * .32),
        (options.band ? along : width) * (.65 + rand() * .38), color, options.style ?? OBJECT, 1, options.bone ?? 0, options.warm);
    }
  }
}
function panel(batch, a, b, c, d, colors, options = {}) {
  const du = Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, d)));
  const dv = Math.max(Math.hypot(...sub(d, a)), Math.hypot(...sub(c, b)));
  const step = options.step ?? .27, stepY = options.stepY ?? step * .76;
  const rows = Math.ceil(dv / stepY), cols = Math.ceil(du / step);
  const normal = unit(cross(sub(b, a), Math.hypot(...sub(d, a)) < .001 ? sub(c, b) : sub(d, a)));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const s = clamp((i + .5 + spread(.71) + (j & 1) * .25) / cols);
    const t = clamp((j + .5 + spread(.66)) / rows);
    const p = lerp3(lerp3(a, b, s), lerp3(d, c, s), t);
    if (options.exclude?.(s, t, p)) continue;
    for (let k = 0; k < 3; k++) p[k] += normal[k] * spread(options.rough ?? .037);
    let tangent = options.dir ?? lerp3(sub(b, a), sub(c, d), t);
    tangent = add(tangent, scale(sub(d, a), spread(.26)));
    const color = typeof colors === 'function' ? colors(s, t, p) : colors;
    dab(batch, p, normal, tangent, du / cols * (.86 + rand() * .50), dv / rows * (.64 + rand() * .46),
      color, options.style ?? OBJECT, options.alpha ?? 1, options.bone ?? 0, options.warm);
  }
}
function box(batch, center, size, colors, options = {}) {
  const [x, y, z] = center, [a, b, c] = size.map(n => n * .5);
  panel(batch, [x-a,y-b,z+c], [x+a,y-b,z+c], [x+a,y+b,z+c], [x-a,y+b,z+c], colors, options);
  panel(batch, [x+a,y-b,z-c], [x-a,y-b,z-c], [x-a,y+b,z-c], [x+a,y+b,z-c], colors, options);
  panel(batch, [x+a,y-b,z+c], [x+a,y-b,z-c], [x+a,y+b,z-c], [x+a,y+b,z+c], colors, options);
  panel(batch, [x-a,y-b,z-c], [x-a,y-b,z+c], [x-a,y+b,z+c], [x-a,y+b,z-c], colors, options);
  panel(batch, [x-a,y+b,z+c], [x+a,y+b,z+c], [x+a,y+b,z-c], [x-a,y+b,z-c], colors, options);
}
function paintedLine(batch, a, b, w, colors, options = {}) {
  const v = sub(b, a), length = Math.hypot(...v);
  const steps = Math.max(1, Math.ceil(length / (options.step ?? w * 2)));
  for (let i = 0; i <= steps; i++) {
    dab(batch, lerp3(a, b, i / steps), options.normal ?? Z, v, length / steps * .92, w * (1 + spread(.35)),
      colors, options.style ?? OBJECT, options.alpha ?? 1, options.bone ?? 0, options.warm);
  }
}

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(.035, .066, .133, 1);
