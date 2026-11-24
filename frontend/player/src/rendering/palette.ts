import { Color } from 'three/webgpu';
import type { BufferAttribute, BufferGeometry } from 'three/webgpu';

const swatchFor = new WeakMap<Color, Swatch>();
const luminance = (c: Color) => .2126 * c.r + .7152 * c.g + .0722 * c.b;
const channel = (value: number) => Math.min(1, Math.max(0, value));
interface Shade { source: Color; color: Color; weight: number }

export class Swatch {
  readonly listeners = new Set<() => void>();
  private readonly base: Color;
  private readonly shades = new Map<string, Shade>();
  private value: string;
  private readonly ink: Color;

  constructor(readonly label: string, readonly original: string) {
    this.value = original;
    this.base = new Color(original);
    this.ink = this.base.clone();
  }

  shade = (source: string | Color = this.original): Color => {
    const color = typeof source === 'string' ? new Color(source) : source;
    const key = `${color.r},${color.g},${color.b}`;
    const cached = this.shades.get(key);
    if (cached) return cached.color;
    const weight = color.equals(this.base) ? 1 : luminance(color) / Math.max(.02, luminance(this.base));
    const shade = {source: color.clone(), color: color.clone(), weight};
    this.shades.set(key, shade);
    swatchFor.set(shade.color, this);
    this.mixShade(shade);
    return shade.color;
  };

  set(value: string) {
    if (this.value === value) return;
    this.value = value;
    this.ink.set(value);
    for (const shade of this.shades.values()) this.mixShade(shade);
    for (const update of this.listeners) update();
  }

  private mixShade({source, color, weight}: Shade) {
    if (this.value === this.original) {
      color.copy(source);
      return;
    }
    // Apply the pigment change at the original shade's lightness.
    color.setRGB(
      channel(source.r + weight * (this.ink.r - this.base.r)),
      channel(source.g + weight * (this.ink.g - this.base.g)),
      channel(source.b + weight * (this.ink.b - this.base.b)),
    );
  }
}

interface ColorBinding {
  index: number;
  shadow: Color;
  light: Color;
  mix: number;
  copies: number;
}

export class PaletteBindings {
  private readonly bySwatch = new Map<Swatch, ColorBinding[]>();

  add(index: number, shadow: Color, light = shadow, mix = 0, copies = 1) {
    const darkSwatch = swatchFor.get(shadow);
    const lightSwatch = light === shadow ? darkSwatch : swatchFor.get(light);
    if (!darkSwatch && !lightSwatch) return;
    const binding = {index, shadow: darkSwatch ? shadow : shadow.clone(), light: lightSwatch ? light : light.clone(), mix, copies};
    if (darkSwatch) this.track(darkSwatch, binding);
    if (lightSwatch && lightSwatch !== darkSwatch) this.track(lightSwatch, binding);
  }

  private track(swatch: Swatch, binding: ColorBinding) {
    const bindings = this.bySwatch.get(swatch);
    if (bindings) bindings.push(binding);
    else this.bySwatch.set(swatch, [binding]);
  }

  attach(geometry: BufferGeometry, attribute: BufferAttribute) {
    for (const [swatch, bindings] of this.bySwatch) {
      const ink = new Color();
      const update = () => {
        for (const {index, shadow, light, mix, copies} of bindings) {
          ink.copy(shadow).lerp(light, mix);
          for (let i = 0; i < copies; i++) attribute.setXYZ(index + i, ink.r, ink.g, ink.b);
        }
        attribute.needsUpdate = true;
      };
      const detach = () => {
        swatch.listeners.delete(update);
        geometry.removeEventListener('dispose', detach);
      };
      swatch.listeners.add(update);
      geometry.addEventListener('dispose', detach);
    }
    this.bySwatch.clear();
  }
}
