// Hard-surface geometry toolbox.
//   geo.*      — parametric primitives with bevels and proper UVs, all merge-safe
//   Assembly   — accumulates parts per material and merges them into a handful of
//                meshes, plus a coarse pick proxy and an outline hull for the module.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MaterialKey, Materials } from './materials';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Rotation that maps a part's +Y axis onto `dir` (rings, bolts, cans).
export function axisTowards(x: number, y: number, z: number) {
  return new THREE.Quaternion().setFromUnitVectors(Y_AXIS, new THREE.Vector3(x, y, z).normalize());
}
// Rotation that maps a part's +Z axis onto `dir` (discs, planes, panels).
export function faceTowards(x: number, y: number, z: number) {
  return new THREE.Quaternion().setFromUnitVectors(Z_AXIS, new THREE.Vector3(x, y, z).normalize());
}
export function turn(angle: number) {
  return new THREE.Quaternion().setFromAxisAngle(Y_AXIS, angle);
}
// Radial direction in the XZ plane at azimuth `angle` (0 = +Z).
export function radial(angle: number, radius: number, y = 0): [number, number, number] {
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
}

export const polar = (angle: number) => ({ x: Math.sin(angle), z: Math.cos(angle) });

function rockGeometry(radius: number, seed: number) {
  const sphere = new THREE.SphereGeometry(radius, 9, 6);
  const position = sphere.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const bump = Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 - seed * 1.3) * 0.18 + Math.sin(y * 4.3 + seed * 2.1) * 0.11;
    const k = 1 + bump;
    position.setXYZ(i, x * k, y * k * 0.6, z * k);
  }
  const flat = sphere.toNonIndexed();
  sphere.dispose();
  flat.computeVertexNormals();
  flat.computeBoundingBox();
  return flat;
}

export const geo = {
  // beveled box — the workhorse for machined plates and housings
  box: (w: number, h: number, d: number, r = 0.015, seg = 2) =>
    new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.33)),
  cyl: (rTop: number, rBottom: number, h: number, seg = 28) => new THREE.CylinderGeometry(rTop, rBottom, h, seg),
  hex: (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 6),
  disc: (r: number, seg = 32) => new THREE.CircleGeometry(r, seg),
  // annular washer lying in the XZ plane (axis +Y)
  ring: (rIn: number, rOut: number, h: number, seg = 56) =>
    new THREE.LatheGeometry([new THREE.Vector2(rIn, -h / 2), new THREE.Vector2(rOut, -h / 2), new THREE.Vector2(rOut, h / 2), new THREE.Vector2(rIn, h / 2)], seg),
  lathe: (profile: Array<[number, number]>, seg = 48) =>
    new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg),
  sphere: (r: number, ws = 32, hs = 18) => new THREE.SphereGeometry(r, ws, hs),
  // upper hemisphere, flat side down at y = 0
  dome: (r: number, ws = 64, hs = 32) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2),
  plane: (w: number, h: number) => new THREE.PlaneGeometry(w, h),
  cone: (r: number, h: number, seg = 30) => new THREE.ConeGeometry(r, h, seg, 1, true),
  torus: (r: number, tube: number, radialSeg = 8, tubularSeg = 40) => new THREE.TorusGeometry(r, tube, radialSeg, tubularSeg),
  tube: (points: Array<[number, number, number]>, radius: number, tubular = 48, radialSeg = 8) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), tubular, radius, radialSeg, false),
  rock: rockGeometry,
};

export type Place = {
  pos?: [number, number, number];
  rot?: [number, number, number];
  quat?: THREE.Quaternion;
  scale?: number | [number, number, number];
};

export type MaterialRef = MaterialKey | THREE.Material;

type Item = { geometry: THREE.BufferGeometry; material: MaterialRef; matrix: THREE.Matrix4; localBox: THREE.Box3 };

export type BuiltModule = {
  group: THREE.Group;
  geometries: THREE.BufferGeometry[];
  outline: THREE.BufferGeometry;
  pick: THREE.BufferGeometry;
  box: THREE.Box3;
  parts: number;
  materials: string[];
};

function placement(place: Place) {
  const position = new THREE.Vector3(...(place.pos ?? [0, 0, 0]));
  const quaternion = place.quat
    ? place.quat.clone()
    : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(place.rot ?? [0, 0, 0])));
  const scale = typeof place.scale === 'number'
    ? new THREE.Vector3(place.scale, place.scale, place.scale)
    : new THREE.Vector3(...(place.scale ?? [1, 1, 1]));
  return { position, quaternion, scale };
}

// Merging needs an identical attribute layout on every input: expand each primitive
// to non-indexed position / normal / uv (RoundedBoxGeometry ships non-indexed, the
// lathe / tube / cylinder primitives ship indexed, so both cases have to meet here).
function normalise(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const result = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  Object.keys(result.attributes).forEach((name) => {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') result.deleteAttribute(name);
  });
  if (!result.attributes.normal) result.computeVertexNormals();
  if (!result.attributes.uv) {
    result.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(result.attributes.position.count * 2), 2));
  }
  return result;
}

export class Assembly {
  private items: Item[] = [];
  private frames: THREE.Matrix4[] = [new THREE.Matrix4()];
  readonly bounds = new THREE.Box3();

  // Nested local frames: everything added between push() and pop() is expressed in
  // that frame (so a lamp head can be authored facing +Z and then aimed once).
  push(place: Place = {}) {
    const { position, quaternion, scale } = placement(place);
    const frame = this.frames[this.frames.length - 1];
    this.frames.push(new THREE.Matrix4().multiplyMatrices(frame, new THREE.Matrix4().compose(position, quaternion, scale)));
    return this;
  }

  pop() {
    if (this.frames.length > 1) this.frames.pop();
    return this;
  }

  add(geometry: THREE.BufferGeometry, material: MaterialRef, place: Place = {}) {
    const { position, quaternion, scale } = placement(place);
    const frame = this.frames[this.frames.length - 1];
    const matrix = new THREE.Matrix4().multiplyMatrices(frame, new THREE.Matrix4().compose(position, quaternion, scale));
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const localBox = (geometry.boundingBox as THREE.Box3).clone();
    const worldBox = localBox.clone().applyMatrix4(matrix);
    if (worldBox.isEmpty() === false) this.bounds.union(worldBox);
    this.items.push({ geometry, material, matrix, localBox });
    return this;
  }

  // Rows / rings of hex fasteners — the detail that sells "assembled, not sculpted".
  studs(positions: Array<[number, number, number]>, radius = 0.022, height = 0.028, material: MaterialRef = 'steel') {
    for (const pos of positions) this.add(geo.hex(radius, height), material, { pos });
    return this;
  }

  studRing(radius: number, count: number, y: number, size = 0.022, material: MaterialRef = 'steel', phase = 0, quat?: THREE.Quaternion) {
    for (let i = 0; i < count; i++) {
      const angle = phase + (i / count) * Math.PI * 2;
      this.add(geo.hex(size, size * 1.3), material, { pos: radial(angle, radius, y), quat });
    }
    return this;
  }

  // Louvred vent panel centred on the origin, facing +Z, w x h in size.
  vent(w: number, h: number, slats: number, frame: MaterialRef = 'anodized', blade: MaterialRef = 'graphite') {
    this.add(geo.box(w, h, 0.05, 0.012), frame);
    const step = (h - 0.06) / slats;
    for (let i = 0; i < slats; i++) {
      const y = -h / 2 + 0.03 + step * (i + 0.5);
      this.add(geo.box(w - 0.08, step * 0.5, 0.035, 0.008), blade, { pos: [0, y, 0.02], rot: [0.55, 0, 0] });
    }
    return this;
  }

  build(materials: Materials): BuiltModule {
    const buckets = new Map<MaterialRef, THREE.BufferGeometry[]>();
    const names = new Map<MaterialRef, string>();
    const solids: THREE.BufferGeometry[] = [];
    const proxies: THREE.BufferGeometry[] = [];

    for (const item of this.items) {
      const geometry = normalise(item.geometry).applyMatrix4(item.matrix);
      const bucket = buckets.get(item.material);
      if (bucket) bucket.push(geometry); else buckets.set(item.material, [geometry]);
      if (!names.has(item.material)) {
        names.set(item.material, typeof item.material === 'string' ? item.material : (item.material.name || 'inline'));
      }

      solids.push(geometry.clone());

      const size = item.localBox.getSize(new THREE.Vector3());
      const centre = item.localBox.getCenter(new THREE.Vector3());
      const proxy = normalise(new THREE.BoxGeometry(Math.max(size.x, 0.02), Math.max(size.y, 0.02), Math.max(size.z, 0.02)));
      proxy.translate(centre.x, centre.y, centre.z);
      proxy.applyMatrix4(item.matrix);
      proxies.push(proxy);
    }

    const group = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    const used: string[] = [];
    buckets.forEach((list, ref) => {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) throw new Error(`hard-surface merge failed for material ${names.get(ref)}`);
      if (list.length > 1) list.forEach((entry) => entry.dispose());
      merged.computeBoundingSphere();
      geometries.push(merged);
      used.push(names.get(ref) as string);
      const mesh = new THREE.Mesh(merged, typeof ref === 'string' ? materials[ref] : ref);
      mesh.name = names.get(ref) as string;
      group.add(mesh);
    });

    const outline = solids.length === 1 ? solids[0] : mergeGeometries(solids, false);
    if (!outline) throw new Error('hard-surface outline merge failed');
    solids.forEach((entry) => { if (entry !== outline) entry.dispose(); });
    outline.computeBoundingSphere();

    const pick = proxies.length === 1 ? proxies[0] : mergeGeometries(proxies, false);
    if (!pick) throw new Error('hard-surface pick merge failed');
    proxies.forEach((entry) => { if (entry !== pick) entry.dispose(); });
    pick.computeBoundingSphere();

    return { group, geometries, outline, pick, box: this.bounds.clone(), parts: this.items.length, materials: used };
  }
}

export function disposeBuilt(module: BuiltModule) {
  module.geometries.forEach((geometry) => geometry.dispose());
  module.outline.dispose();
  module.pick.dispose();
}
