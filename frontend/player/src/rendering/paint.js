import * as THREE from 'three/webgpu';
import {
  Fn, abs, attribute, cameraPosition, cross, dot, exp, float, fract, fwidth,
  max, mix, modelWorldMatrix, normalize, positionGeometry, reflect, sin,
  smoothstep, uniform, uv, varying, vec3, vec4
} from 'three/tsl';
import { PaletteBindings } from './palette';

export { THREE };
export const TAU = Math.PI * 2;
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const mixNumber = (a, b, t) => a + (b - a) * t;
export function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export const point = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const up = point(0, 1, 0);
export const moonDirection = point(.454, .260, -.853).normalize();

export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let bits = Math.imul(state ^ (state >>> 15), 1 | state);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), 61 | bits);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {string | THREE.Color} shadow @param {string | THREE.Color} light */
export function palette(shadow, light) {
  return [typeof shadow === 'string' ? new THREE.Color(shadow) : shadow,
    typeof light === 'string' ? new THREE.Color(light) : light];
}
export function blendPalette(a, b, t) {
  return [
    a[0].clone().lerp(b[0], t),
    a[1].clone().lerp(b[1], t)
  ];
}

const ambientBlue = new THREE.Color('#536e9f');
const fillMaterial = new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide});
const brushGeometry = new THREE.PlaneGeometry(1, 1);
const paletteTemp = new THREE.Color();
const axisReference = point();
const scratchNormal = point();
const fadeDown = (outer, inner, value) => smoothstep(inner, outer, value).oneMinus();

export function makePaint(shared, groupColor) {
  const time = shared?.time ?? uniform(0);
  const flowTime = shared?.flowTime ?? uniform(0);
  const lamp = shared?.lamp ?? uniform(point(-200, 0, 0));
  const grassFocus = shared?.grassFocus ?? uniform(point());
  const target = uniform(new THREE.Color());
  const strength = uniform(0);
  // Preserve the brush shading and contrast while changing the group's dominant color.
  const grade = color => groupColor ? mix(color,
    target.mul(dot(color, vec3(.21, .72, .07)).max(0).sqrt().mul(1.35).add(.18)), strength) : color;
  const fill = groupColor ? new THREE.MeshBasicNodeMaterial({side: THREE.DoubleSide}) : fillMaterial;
  if (groupColor) fill.colorNode = grade(attribute('color', 'vec3'));
  const setColor = color => {
    target.value.set(color);
    strength.value = color.toLowerCase() === groupColor?.toLowerCase() ? 0 : .72;
  };
  const moon = uniform(moonDirection);
  const mist = uniform(new THREE.Color('#344765'));
  const warmth = uniform(new THREE.Color('#ef9b37'));
  const moonBlue = uniform(ambientBlue);

  const center = attribute('brushCenter', 'vec3');
  const axis = attribute('brushAxis', 'vec3');
  const across = attribute('brushAcross', 'vec3');
  const info = attribute('brushInfo', 'vec4');
  const worldCenter = modelWorldMatrix.mul(vec4(center, 1)).xyz;
  const animation = info.z;
  const water = smoothstep(.6, .95, animation).mul(fadeDown(1.4, 1.1, animation));
  const stalk = smoothstep(1.6, 1.96, animation).mul(fadeDown(2.4, 2.1, animation));
  const cascade = smoothstep(2.6, 2.96, animation).mul(fadeDown(3.4, 3.1, animation));
  const grass = smoothstep(3.6, 4, animation);
  const distanceToCamera = worldCenter.sub(cameraPosition).length();
  const distant = smoothstep(12, 105, distanceToCamera).mul(info.w.oneMinus());
  const density = distant.mul(.69).oneMinus();
  const keep = smoothstep(info.x.sub(.16), info.x.add(.065), density);
  const grassFade = mix(float(1), fadeDown(16, 9, worldCenter.sub(grassFocus).length()), grass);
  const scale = mix(float(1), float(1.83), distant).mul(keep.sqrt()).mul(grassFade.sqrt());
  const phase = center.x.mul(.79).add(center.z.mul(.62)).add(info.x.mul(12));

  const vInfo = varying(info);
  const vPoint = varying(worldCenter);
  const vNormal = varying(normalize(modelWorldMatrix.mul(vec4(cross(axis, across), 0)).xyz));
  const vFade = varying(keep.mul(grassFade));
  const vDistance = varying(distanceToCamera);
  const low = varying(attribute('brushDark', 'vec3'));
  const high = varying(attribute('brushLight', 'vec3'));

  const material = new THREE.MeshBasicNodeMaterial({side: THREE.DoubleSide, alphaToCoverage: false});
  material.positionNode = Fn(() => {
    const offset = vec3(
      sin(flowTime.mul(1.9).add(phase)).mul(water.mul(.23)).add(sin(time.mul(1.9).add(phase)).mul(stalk.mul(.066).add(grass.mul(.07)))),
      sin(flowTime.mul(2.7).add(phase)).mul(water.mul(.028)).sub(sin(time.mul(6.3).add(phase)).mul(cascade.mul(.14))),
      sin(time.mul(1.62).add(phase)).mul(stalk.mul(.035).add(grass.mul(.042)))
    );
    return center.add(axis.mul(positionGeometry.x).add(across.mul(positionGeometry.y)).mul(scale)).add(offset);
  })();

  const fiber = uv();
  const x = fiber.x.mul(2).sub(1);
  const y = fiber.y.mul(2).sub(1);
  const seed = vInfo.x;
  const slub = sin(fiber.y.mul(64).add(seed.mul(71))).mul(.043)
    .add(sin(fiber.y.mul(141).add(seed.mul(39))).mul(.023));
  const narrowing = abs(x).pow(3.1).mul(.28).oneMinus();
  const shape = max(abs(y).div(narrowing), abs(x).add(slub).add(.03));
  const coverage = fadeDown(1.01, .82, shape);
  material.opacityNode = coverage.mul(vFade);
  material.alphaTestNode = float(.24);

  material.colorNode = Fn(() => {
    // The nine grooves stay attached to the quad as it moves or changes LOD.
    const bend = sin(fiber.x.mul(5.9).add(seed.mul(10))).mul(.15);
    const lane = fract(fiber.y.mul(9).add(bend).add(seed.mul(.26)));
    const edge = smoothstep(.03, .32, lane).mul(fadeDown(.86, .38, lane));
    const groove = smoothstep(.06, .60, fwidth(fiber.y).mul(9)).oneMinus();
    const grain = sin(fiber.x.mul(24).add(lane.mul(3)).add(seed.mul(39))).mul(.035);
    const incident = dot(vNormal.normalize(), moon).max(0);
    const raisedEdge = fadeDown(.91, .58, shape).mul(.09);
    const lobe = mix(float(.18), float(.80), incident)
      .add(edge.sub(.46).mul(.38).mul(groove)).add(grain).add(raisedEdge)
      .add(seed.sub(.5).mul(.26));
    const emission = vInfo.y;
    const materialShade = mix(lobe, float(.69).add(edge.sub(.38).mul(.40).mul(groove)).add(grain).add(seed.sub(.5).mul(.30)), emission);
    const body = mix(low, high, materialShade.clamp(0, 1));
    const desaturated = mix(body, vec3(dot(body, vec3(.21, .72, .07))).mul(vec3(.68, .93, 1.4)), incident.mul(.14).mul(emission.oneMinus()));
    const localDistance = vPoint.sub(lamp).length();
    const local = fadeDown(6.2, 0.5, localDistance).mul(emission.oneMinus()).mul(.50);
    const warmBody = desaturated.add(moonBlue.mul(.14).mul(incident).mul(emission.oneMinus()))
      .add(warmth.mul(local.mul(.57)).mul(body.add(.15)));
    const wet = smoothstep(.6, .95, vInfo.z).mul(fadeDown(1.4, 1.1, vInfo.z));
    const falls = smoothstep(2.6, 2.95, vInfo.z).mul(fadeDown(3.4, 3.1, vInfo.z));
    const viewRay = normalize(vPoint.sub(cameraPosition));
    const reflected = reflect(viewRay, vec3(0, 1, 0));
    const moonGlint = smoothstep(.836, .987, dot(reflected, moon)).mul(wet);
    const ripple = sin(vPoint.z.mul(6.2).add(flowTime.mul(3.2)).add(vPoint.x.mul(2.8))).mul(.48).add(.52);
    const spill = sin(vPoint.y.mul(8).add(time.mul(12)).add(seed.mul(18))).mul(.23).add(.85);
    const lit = warmBody.mul(mix(float(1), spill, falls))
      .add(warmth.mul(moonGlint.mul(ripple).mul(.38)))
      .add(vec3(.04, .08, .15).mul(wet.mul(ripple).mul(.31)));
    const haze = smoothstep(29, 198, vDistance).mul(.42).mul(vInfo.w.oneMinus());
    return grade(mix(lit, mist, haze));
  })();

  return { material, fill, grade, setColor, time, flowTime, lamp, grassFocus };
}

// Batches store the center and two physical tangent vectors of each painted mark.
export class BrushBatch {
  constructor(paint, rng, fraction = 1) {
    this.paint = paint;
    this.rng = rng;
    this.fraction = fraction;
    this.centers = [];
    this.axes = [];
    this.crosses = [];
    this.darks = [];
    this.lights = [];
    this.darkBindings = new PaletteBindings();
    this.lightBindings = new PaletteBindings();
    this.info = [];
    this.bounds = new THREE.Box3();
  }

  stroke(center, direction, normal, length, width, colors, emit = 0, motion = 0, unbounded = 0) {
    const seed = this.rng();
    // Preserve the seeded geometry when the mobile version drops some marks.
    if (this.fraction < 1 && fractRandom(seed * 149.654 + .421) > this.fraction) return;
    const tangent = axisReference.copy(direction).addScaledVector(normal, -direction.dot(normal)).normalize();
    if (tangent.lengthSq() < 0.5) return;
    const other = scratchNormal.crossVectors(normal, tangent).normalize();
    const scale = clamp(length, .022, 21);
    const breadth = clamp(width, .011, 8.4);
    this.centers.push(center.x, center.y, center.z);
    this.axes.push(tangent.x * scale, tangent.y * scale, tangent.z * scale);
    this.crosses.push(other.x * breadth, other.y * breadth, other.z * breadth);
    this.info.push(seed, emit, motion, unbounded);
    const index = this.darks.length / 3;
    this.darkBindings.add(index, colors[0]);
    this.lightBindings.add(index, colors[1]);
    this.darks.push(colors[0].r, colors[0].g, colors[0].b);
    this.lights.push(colors[1].r, colors[1].g, colors[1].b);
    this.bounds.expandByPoint(center);
  }

  finish(parent, name = 'Oil paint strokes') {
    const count = this.info.length / 4;
    if (!count) return null;
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = brushGeometry.index;
    geometry.setAttribute('position', brushGeometry.attributes.position);
    geometry.setAttribute('uv', brushGeometry.attributes.uv);
    geometry.instanceCount = count;
    for (const [name, values, size] of [
      ['brushCenter', this.centers, 3], ['brushAxis', this.axes, 3],
      ['brushAcross', this.crosses, 3], ['brushDark', this.darks, 3],
      ['brushLight', this.lights, 3], ['brushInfo', this.info, 4]
    ]) {
      geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(values), size));
      values.length = 0;
    }
    geometry.boundingBox = this.bounds.expandByScalar(3);
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    this.darkBindings.attach(geometry, geometry.getAttribute('brushDark'));
    this.lightBindings.attach(geometry, geometry.getAttribute('brushLight'));
    const mesh = new THREE.Mesh(geometry, this.paint.material);
    mesh.name = name;
    mesh.userData.strokes = count;
    parent.add(mesh);
    return mesh;
  }
}

const fractRandom = (x) => x - Math.floor(x);

export class PaintLayer {
  constructor(parent, paint, rng, fraction) {
    this.parent = parent;
    this.paint = paint;
    this.rng = rng;
    this.brush = new BrushBatch(paint, rng, fraction);
    this.positions = [];
    this.colors = [];
    this.colorBindings = new PaletteBindings();
  }

  triangle(a, b, c, normal, colors, emission = 0, tone = 0) {
    const diffuse = clamp(.12 + .55 * Math.max(0, normal.dot(moonDirection)) + emission * .67 + tone);
    paletteTemp.copy(colors[0]).lerp(colors[1], diffuse);
    this.colorBindings.add(this.colors.length / 3, colors[0], colors[1], diffuse, 3);
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.colors.push(
      paletteTemp.r, paletteTemp.g, paletteTemp.b,
      paletteTemp.r, paletteTemp.g, paletteTemp.b,
      paletteTemp.r, paletteTemp.g, paletteTemp.b
    );
  }

  // Paint a parallelogram with staggered rows of overlapping marks.
  face(a, along, upward, colors, step = .23, emit = 0, directionBlend = .19) {
    const normal = point().crossVectors(along, upward).normalize();
    const b = a.clone().add(along);
    const c = b.clone().add(upward);
    const d = a.clone().add(upward);
    this.triangle(a, b, c, normal, colors, emit);
    this.triangle(a, c, d, normal, colors, emit);
    const columns = Math.max(1, Math.ceil(along.length() / (step * 1.65)));
    const rows = Math.max(1, Math.ceil(upward.length() / (step * .81)));
    const major = along.clone().normalize();
    const crosswise = upward.clone().normalize();
    const at = point();
    const dir = point();
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const u = (column + .15 + .7 * this.rng()) / columns;
        const v = (row + .13 + .74 * this.rng()) / rows;
        at.copy(a).addScaledVector(along, u).addScaledVector(upward, v).addScaledVector(normal, .012);
        dir.copy(major).addScaledVector(crosswise, (this.rng() - .39) * directionBlend * 2);
        this.brush.stroke(at, dir, normal, step * (1.44 + this.rng()), step * (.68 + this.rng() * .58), colors, emit);
      }
    }
  }

  box(center, size, colors, step = .2, emit = 0) {
    const [x, y, z] = [center.x - size.x / 2, center.y - size.y / 2, center.z - size.z / 2];
    const a = point(x, y, z);
    const dx = point(size.x, 0, 0);
    const dy = point(0, size.y, 0);
    const dz = point(0, 0, size.z);
    this.face(a.clone().add(dz), dx, dy, colors, step, emit);
    this.face(a.clone().add(dx), dx.clone().negate(), dy, colors, step, emit);
    this.face(a.clone().add(dx).add(dz), dz.clone().negate(), dy, colors, step, emit);
    this.face(a, dz, dy, colors, step, emit);
    this.face(a.clone().add(dy).add(dz), dx, dz.clone().negate(), colors, step, emit);
    this.face(a, dx, dz, colors, step, emit);
  }

  // A solid ellipsoid with a second, independent skin of curved paint strokes.
  /** @param {import('three/webgpu').Quaternion | null} rotation */
  oval(center, radii, colors, count, rotation = null, emit = 0, directionBias = 0) {
    const sample = (t, a) => {
      const r = Math.sqrt(Math.max(0, 1 - t * t));
      const radial = point(r * Math.cos(a), t, r * Math.sin(a));
      const p = radial.clone().multiply(radii);
      const n = radial.clone().divide(radii).normalize();
      if (rotation) { p.applyQuaternion(rotation); n.applyQuaternion(rotation); }
      return [p.add(center), n];
    };
    const nRows = 8;
    const nCols = 14;
    const rings = Array.from({length:nRows + 1}, (_, j) =>
      Array.from({length:nCols}, (_, i) => sample(Math.cos(Math.PI * j / nRows), TAU * i / nCols)));
    for (let j = 0; j < nRows; j++) {
      for (let i = 0; i < nCols; i++) {
        const next = (i + 1) % nCols;
        const [a, na] = rings[j][i];
        const [b, nb] = rings[j][next];
        const [c, nc] = rings[j + 1][next];
        const [d, nd] = rings[j + 1][i];
        const n = na.clone().add(nb).add(nc).add(nd).normalize();
        this.triangle(a, b, c, n, colors, emit);
        this.triangle(a, c, d, n, colors, emit);
      }
    }
    const scale = Math.cbrt(radii.x * radii.y * radii.z);
    const length = scale * Math.sqrt(18 / Math.max(1, count));
    for (let i = 0; i < count; i++) {
      const t = 1 - (i + this.rng()) / count * 2;
      const angle = (i * 2.399963 + this.rng() * .51) % TAU;
      const [p, n] = sample(t, angle);
      const d = point(-Math.sin(angle), (this.rng() - .5) * .44 + directionBias, Math.cos(angle));
      if (rotation) d.applyQuaternion(rotation);
      p.addScaledVector(n, .005 + scale * .023);
      this.brush.stroke(p, d, n, length * (1.32 + this.rng() * .89), length * (.38 + this.rng() * .43), colors, emit);
    }
  }

  finish(name = 'Painted surfaces') {
    if (this.positions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
      this.colorBindings.attach(geometry, geometry.getAttribute('color'));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.paint.fill);
      mesh.name = name + ' underpainting';
      this.parent.add(mesh);
      this.positions.length = 0;
      this.colors.length = 0;
    }
    return this.brush.finish(this.parent, name);
  }
}

export function paintedLine(brush, a, b, normal, width, colors, pieces = 1, emit = 0, anim = 0, pin = 0) {
  const span = b.clone().sub(a);
  const len = span.length();
  if (len < .001) return;
  const mark = span.clone().normalize();
  for (let i = 0; i < pieces; i++) {
    const at = a.clone().addScaledVector(span, (i + .5) / pieces);
    brush.stroke(at, mark, normal, len / pieces * 1.14, width, colors, emit, anim, pin);
  }
}
