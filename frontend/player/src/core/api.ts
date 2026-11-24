import type * as Three from 'three/webgpu';
import type * as Nodes from 'three/tsl';
import type { PaintLayer, makePaint } from '../rendering/paint.js';

export type V3 = [number, number, number];
export type Value = number | string;
export type Values = Record<string, Value>;
export type ColorGroup = 'sky' | 'water' | 'architecture';
export type SwatchColor = (shade?: string | Three.Color) => Three.Color;
export type Field = { kind: 'color'; label: string; value: string }
  | { kind: 'number'; label: string; value: number; min: number; max: number; step?: number };
export type Box = { center: V3; size: V3 };
export interface EntitySpec {
  id: string; name: string; kind?: string; role?: 'subject'; position?: V3; yaw?: number; scale?: number;
  box?: Box; solid?: boolean; jumpable?: boolean; movable?: boolean; fields?: Record<string, Field>;
  colorGroup?: ColorGroup;
}
export interface Drawing {
  group: Three.Group; layer: PaintLayer; values: Values; random: () => number;
  onFrame(callback: (time: number, dt: number) => void): void;
}
export interface Environment {
  background?: string | Three.Color; eye?: V3; look?: V3; route?: V3[]; rider?: boolean;
  height?: (x: number,z: number) => number;
  tour?: { eye: V3; look: V3 }[]; terrainBounds?: [number,number,number,number];
}
export interface WorldAPI {
  THREE: typeof Three; TSL: typeof Nodes; scene: Three.Scene; paint: ReturnType<typeof makePaint>;
  seed: number; fraction: number; palette: string[]; subject: boolean;
  point(x?: number,y?: number,z?: number): Three.Vector3;
  colors(shadow: string | Three.Color, light: string | Three.Color): Three.Color[];
  swatch(group: ColorGroup, id: string, label: string, color: string): SwatchColor;
  layer(parent: Three.Object3D, seed?: number, colorGroup?: ColorGroup): PaintLayer;
  environment(values: Environment): void;
  entity(spec: EntitySpec, draw?: (object: Drawing) => void): Three.Group;
  starryRide(): void;
}
export interface ObjectState { position: V3; yaw: number; scale: number; values: Values }
export type Snapshot = Record<string, ObjectState>;
export interface Meta { title: string; seed: number; palette: string[]; subject: boolean; version: 1; description: string }
