import { THREE, BrushBatch, TAU, clamp, mixNumber, palette, point, random } from '../../rendering/paint.js';
import { Fn, mix, positionGeometry, smoothstep, uniform } from 'three/tsl';

const sphereRadius = 420;
const cobalt = [
  palette('#0d2352', '#1d3c81'), palette('#112d66', '#2654a0'),
  palette('#18406f', '#3778ae'), palette('#174b77', '#4294b3'),
  palette('#205b7b', '#64aeb7'), palette('#273c81', '#455fa6'),
  palette('#122444', '#224872')
];
const currents = [
  palette('#173f78', '#4288b6'), palette('#286183', '#6aaeb9'),
  palette('#15447e', '#386fad'), palette('#385a91', '#7295bf'),
  palette('#18586e', '#60a1a5'), palette('#12336c', '#2d5da3'),
  palette('#326985', '#78b4b8'), palette('#18386d', '#4373ac')
];
const gold = [
  palette('#ad5326', '#f2a940'), palette('#d47c2a', '#ffc761'),
  palette('#c88135', '#ffdb79'), palette('#f3ae4b', '#ffe59c'),
  palette('#eabe63', '#fff1ae')
];
const outerHalo = [
  palette('#1a4a6c', '#468d9b'), palette('#387183', '#8bb6a1'),
  palette('#6d836f', '#bbab71'), palette('#987746', '#ddb25e')
];
const hemisphere = (az, el, r = sphereRadius) =>
  point(Math.sin(az) * Math.cos(el) * r, 4 + Math.sin(el) * r, -Math.cos(az) * Math.cos(el) * r);

function markSky(brush, az, el, angle, len, width, color, depth) {
  const p = hemisphere(az, el, depth);
  const n = point(-p.x, 4 - p.y, -p.z).normalize();
  const tangent = hemisphere(az + Math.cos(angle) * .002, el + Math.sin(angle) * .002, depth).sub(p);
  brush.stroke(p, tangent, n, len * depth, width * depth, color, 1, 0, 1);
}

function ribbon(brush, rng, getPoint, options) {
  const { rows, steps, width, depth, colors, thickness = 1, irregularity = 1 } = options;
  for (let row = 0; row < rows; row++) {
    const lane = (row / (rows - 1) - .5) * width;
    const color = colors[(row + (row % 3 === 0 ? 1 : 0)) % colors.length];
    const trim = .065 * Math.abs(lane) / width;
    for (let i = 0; i < steps; i++) {
      const t = (i + rng()) / steps;
      if (t < trim || t > 1 - trim * .75 || rng() < .055) continue;
      const [a, b] = getPoint(t);
      const [c, d] = getPoint(t + .0005);
      const turn = Math.atan2(d - b, c - a);
      const wave = Math.sin(t * 31 + row * .66) * width * .037 * irregularity;
      const offset = (lane + wave) * (.54 + .64 * Math.sin(Math.PI * t) + t * .21);
      const v = (rng() - .5) * width / rows * 1.45;
      const bend = turn + (rng() - .5) * .36;
      const size = clamp(Math.hypot(c - a, d - b) / .0005 / steps * (1.06 + rng() * 1.18), .006, .042);
      markSky(brush, a - Math.sin(turn) * (offset + v), b + Math.cos(turn) * (offset + v), bend,
        size * thickness, (width / rows) * (.74 + rng() * 1.17) * thickness, rng() < .105 ? colors[Math.floor(rng() * colors.length)] : color,
        depth + (rng() - .5) * .85 + row * .037);
    }
  }
}

function spiral(brush, rng, az, el, rx, ry, start, winding, tailX, tailY, width, depth, steps, rows, colors) {
  ribbon(brush, rng, t => {
    const turn = start + winding * (TAU * 1.58 * t + .36 * Math.sin(t * 4));
    const radius = .045 + .955 * Math.pow(t, 1.36);
    return [
      az + Math.cos(turn) * rx * radius + tailX * Math.pow(t, 3.55),
      el + Math.sin(turn) * ry * radius + tailY * Math.pow(t, 3)
    ];
  }, {rows, steps, width, depth, colors, thickness: 1.16});
}

function halo(brush, rng, az, el, radius, rings, {light, edge}, moon = false) {
  for (let i = 0; i < rings; i++) {
    const r = radius * (1.08 + i * (moon ? .155 : .24));
    const length = Math.ceil((moon ? 92 : 31) + i * (moon ? 12 : 3));
    const colors = i <= 1 ? light[i + 1] : edge[Math.max(0, 4 - i)];
    for (let j = 0; j < length; j++) {
      const t = (j + rng() * .85) * TAU / length;
      if (rng() < (i > 2 ? .18 : .035)) continue;
      const rv = r * (1 + .03 * Math.sin(t * 3 + i) + .04 * (rng() - .5));
      const waviness = .017 * Math.sin(t * 5 + i * .8);
      markSky(brush, az + Math.cos(t) * rv * 1.075, el + Math.sin(t) * rv * .945,
        t + Math.PI / 2 + waviness, r * TAU / length * (1.42 + rng() * 1.24),
        radius * (.07 + rng() * (moon ? .124 : .092)), colors, 406 - i * .09 + rng() * .48);
    }
  }
}

function fullMoon(parent, brush, rng, az, el, moon, colors) {
  const radius = .055;
  halo(brush, rng, az, el, radius, 8, colors, true);
  const geo = new THREE.CircleGeometry(410 * radius, 100);
  const material = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
  material.color = moon('#d59135');
  const fill = new THREE.Mesh(geo, material);
  fill.position.copy(hemisphere(az, el, 411));
  fill.lookAt(0, 4, 0);
  parent.add(fill);
  for (let i = 0; i < 1830; i++) {
    const a = (i * 2.399964 + rng() * .28) % TAU;
    const r = Math.sqrt((i + rng()) / 1830) * radius;
    const x = az + Math.cos(a) * r / Math.cos(el);
    const y = el + Math.sin(a) * r;
    const edge = r / radius;
    const glimmer = clamp(.63 + Math.sin(x * 96 + y * 72) * .14 + Math.sin(y * 233) * .12 - .3 * edge);
    const tint = colors.light[Math.min(colors.light.length - 1, Math.floor((.21 * rng() + glimmer * .79) * colors.light.length))];
    const dir = a + Math.PI / 2 + Math.sin(r * 92) * .43 + (rng() - .5) * .7;
    markSky(brush, x, y, dir, .0049 + rng() * .008, .00145 + rng() * .0025,
      tint, 399 + rng() * 4.8);
  }
}

function star(brush, rng, a, b, radius, phase, colors) {
  halo(brush, rng, a, b, radius * .85, 4, colors);
  for (let j = 0; j < 43; j++) {
    const angle = j * 2.39996;
    const dist = radius * Math.sqrt(j / 43) * .77;
    markSky(brush, a + Math.cos(angle) * dist, b + Math.sin(angle) * dist,
      angle + 1.2, radius * (.34 + rng() * .63), radius * (.12 + rng() * .18),
      colors.light[j % 3 + 2], 400 + rng());
  }
  for (let ray = 0; ray < 8; ray++) {
    const angle = (ray / 8) * TAU + phase;
    const length = radius * (ray % 2 === 0 ? 1.95 : 1.36);
    markSky(brush, a + Math.cos(angle) * length * .76, b + Math.sin(angle) * length * .76,
      angle + .07 * Math.sin(ray), length * (1 + rng() * .23), radius * (.11 + rng() * .12),
      colors.light[ray % 2 ? 2 : 4], 399 + rng());
  }
}

export function buildSky(parent, paint, fraction, api) {
  const upperSky = api.swatch('sky', 'upper-sky', 'Nền trời trên cao', '#080e28');
  const middleSky = api.swatch('sky', 'middle-sky', 'Nền trời giữa', '#101e49');
  const horizon = api.swatch('sky', 'horizon', 'Ánh chân trời', '#263e65');
  const blue = api.swatch('sky', 'cobalt', 'Nét xanh cobalt', '#3778ae');
  const eddy = api.swatch('sky', 'currents', 'Vệt xoáy', '#6aaeb9');
  const starlight = api.swatch('sky', 'starlight', 'Ánh sao', '#fff1ae');
  const moonlight = api.swatch('sky', 'moon', 'Mặt trăng', '#ffdb79');
  const shadow = palette(upperSky('#08132f'), middleSky('#102454'));
  const cobaltColors = cobalt.map(pair => pair.map(blue));
  const currentColors = currents.map(pair => pair.map(eddy));
  const starColors = {light: gold.map(pair => pair.map(starlight)), edge: outerHalo.map(pair => pair.map(starlight))};
  const moonColors = {light: gold.map(pair => pair.map(moonlight)), edge: outerHalo.map(pair => pair.map(moonlight))};
  api.environment({background:middleSky('#162441')});
  const fill = new THREE.MeshBasicNodeMaterial({side: THREE.BackSide, depthWrite: true});
  const bottom = uniform(horizon());
  const middle = uniform(middleSky());
  const top = uniform(upperSky());
  fill.colorNode = Fn(() => {
    const el = positionGeometry.y.div(sphereRadius);
    return paint.grade(mix(mix(bottom, middle, smoothstep(-.08, .3, el)), top, smoothstep(.23, .66, el)));
  })();
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius, 64, 36), fill);
  atmosphere.position.y = 4;
  atmosphere.name = 'Night sky underpainting';
  parent.add(atmosphere);

  const rng = random(276190);
  const brush = new BrushBatch(paint, rng, Math.max(.87, fraction));
  for (let i = 0; i < 46100; i++) {
    const nearNorth = i < 31700;
    const az = (rng() - .5) * (nearNorth ? 2.92 : TAU);
    const el = -.085 + Math.pow(rng(), nearNorth ? 1.58 : 1.5) * (nearNorth ? .87 : 1.62);
    const wave = .14 + .072 * Math.sin(az * 3.2 + .84) + .045 * Math.sin(az * 8.1);
    const layer = Math.sin((el - wave) * 48 + .7 * Math.sin(az * 12));
    const density = Math.exp(-Math.abs(el - wave) * 4.4);
    let colors = shadow;
    if (rng() < mixNumber(.26, .95, density)) {
      const index = Math.floor(clamp((layer * .29 + .31) * density + rng() * .45, 0, .999) * cobaltColors.length);
      colors = cobaltColors[index];
    }
    const swirlA = -.14;
    const swirlB = .256;
    const r2 = (az - swirlA) ** 2 + ((el - swirlB) * 1.8) ** 2;
    const drift = Math.atan2(el - swirlB, az - swirlA) + Math.PI / 2;
    const curl = Math.exp(-r2 * 29) * .65;
    const angle = .29 * Math.cos(az * 3.4 + el * 14) + .12 * layer + (rng() - .5) * .6 + curl * Math.sin(drift);
    markSky(brush, az, el, angle, .011 + rng() * .032, .0025 + rng() * .0088, colors, 413.1 + 5.6 * rng());
  }

  ribbon(brush, rng, t => {
    const az = -1.53 + t * 3.07;
    return [az, .048 + .105 * Math.sin(t * TAU * .96 + 1.1) + .039 * Math.cos(t * 15 + .4)];
  }, {rows: 19, steps: 172, width: .086, depth: 410,
    colors: [cobaltColors[0], cobaltColors[2], cobaltColors[5], cobaltColors[6], currentColors[2], cobaltColors[1]]});

  ribbon(brush, rng, t => {
    const az = -.91 + t * 1.94;
    return [az, .083 + .055 * Math.cos(t * 12.3 + .29) + .066 * Math.sin(t * 5.1)];
  }, {rows: 14, steps: 129, width: .049, depth: 407.9,
    colors: [cobaltColors[2], currentColors[0], cobaltColors[3], cobaltColors[5], currentColors[4]]});

  spiral(brush, rng, -.19, .255, .37, .133, .92, 1, .40, -.045, .074, 409, 169, 21, currentColors);
  spiral(brush, rng, .175, .145, .217, .083, -.22, -1, -.17, -.02, .052, 409.1, 121, 14, currentColors);
  spiral(brush, rng, .84, .334, .29, .16, 1.3, 1, .21, -.03, .068, 410, 131, 14, currentColors);
  spiral(brush, rng, -1.08, .305, .27, .143, 1.4, 1, -.27, -.04, .067, 409, 99, 12, currentColors);
  spiral(brush, rng, 2.35, .255, .41, .16, .49, 1, .14, -.04, .065, 410, 106, 13, currentColors);
  spiral(brush, rng, -2.5, .25, .44, .132, .33, -1, -.29, -.08, .086, 410, 108, 13, currentColors);

  for (let i = 0; i < 183; i++) {
    const az = (rng() - .5) * TAU;
    const el = .085 + rng() * 1.26;
    markSky(brush, az, el, rng() * TAU, .0027 + rng() * .004, .0014 + rng() * .0016,
      i % 7 ? starColors.edge[2] : starColors.light[2], 401 + rng());
  }
  const stars = [
    [-.67,.25,.019,.07], [-.50,.382,.017,.21], [-.38,.123,.010,.21],
    [-.235,.389,.014,.44], [-.045,.323,.023,.15], [.119,.34,.012,.3],
    [.275,.345,.019,.05], [.322,.212,.009,.34], [.633,.115,.014,.51],
    [.765,.29,.019,.24], [.922,.398,.022,.1], [-.923,.20,.016,.2],
    [1.14,.23,.014,.25], [1.45,.35,.015,.31], [-1.56,.40,.022,.07],
    [-2.3,.21,.014,.34], [2.7,.31,.019,.52], [2.1,.47,.023,.17],
    [-.93,.60,.013,.35], [.40,.56,.017,.34], [.86,.66,.015,.25]
  ];
  for (const [a,b,r,p] of stars) star(brush, rng, a,b,r,p,starColors);
  fullMoon(parent, brush, rng, .49, .263, moonlight, moonColors);
  return brush.finish(parent, 'Sky currents, stars and moon');
}
