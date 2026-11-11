import * as THREE from 'three';
import type { DisplayCar } from './import-car';

/**
 * Drives the workshop 911 from the Parts Drop collection.
 *
 * The shipped GLB is an exterior-only shell — it has no engine, gearbox, brake
 * or damper geometry — so the five collectable parts are represented by their
 * own low-poly modules anchored to the body. A module the player owns reads
 * solid bright steel and lifts off the ghost state; one still missing reads as a
 * grey ghost, so a glance at the car says exactly how much of the set is in the
 * garage. (The owned tint used to be gold — set GOLD_HIGHLIGHT back to true to
 * get that look.)
 *
 * Everything is derived from the loaded model's own bounding box, so the
 * placement survives a model swap instead of being pinned to magic numbers.
 */
export type PartModules = {
  group: THREE.Group;
  /** Highlight owned parts; a part that just flipped to owned flashes once. */
  sync(owned: readonly string[], delta: number): void;
};

const ALL = ['engine', 'transmission', 'wheels', 'brakes', 'suspension'] as const;
type Zone = (typeof ALL)[number];

const GREY = new THREE.Color('#8a9198');
/** 已收集零件的强调色开关：原来的金色高亮，用户要求「车的零件金色先取消」→ false（中性钢色）。 */
const GOLD_HIGHLIGHT = false;
const GOLD = new THREE.Color(GOLD_HIGHLIGHT ? '#dcac30' : '#c6ccd2');
const GLOW = new THREE.Color(GOLD_HIGHLIGHT ? '#6d4004' : '#aeb7bf');

function zoneMaterial() {
  return new THREE.MeshStandardMaterial({
    color: GREY.clone(), metalness: .92, roughness: .3,
    transparent: true, opacity: .42, depthWrite: false,
    emissive: GLOW.clone(), emissiveIntensity: 0,
  });
}

/** A helical coil spring standing along +Y, centred on its own origin. */
function springGeometry(radius: number, height: number, turns = 6) {
  const steps = turns * 12;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2 * turns;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      (i / steps) * height - height / 2,
      Math.sin(angle) * radius,
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, radius * .18, 6, false);
}

export function createPartModules(car: Pick<DisplayCar, 'group' | 'rims'>): PartModules {
  const group = new THREE.Group();
  group.name = 'part-modules';
  car.group.add(group);
  car.group.updateMatrixWorld(true);

  // Local-space frame of the car: +Z is the nose (import-car.ts offsets the
  // front bumper by +z), y starts at the ground, and x is the track direction.
  const world = new THREE.Box3().setFromObject(car.group);
  const min = car.group.worldToLocal(world.min.clone());
  const max = car.group.worldToLocal(world.max.clone());
  const width = Math.max(max.x - min.x, .1);
  const height = Math.max(max.y - min.y, .1);
  const length = Math.max(max.z - min.z, .1);
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  const y0 = min.y;
  const rear = min.z;
  const axleX = width * .42;
  const wheelY = y0 + length * .076;
  const axleFront = cz + length * .272;
  const axleRear = cz - length * .272;
  const deck = y0 + height * .8;

  const materials: Record<string, THREE.MeshStandardMaterial> = {};
  const mount = new THREE.MeshStandardMaterial({ color: '#2b2f33', metalness: .5, roughness: .55 });

  const part = (id: Exclude<Zone, 'wheels'>, build: (material: THREE.Material) => THREE.Object3D) => {
    const material = zoneMaterial();
    materials[id] = material;
    const node = build(material);
    node.name = `module-${id}`;
    group.add(node);
  };
  const place = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rotation?: THREE.Euler) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.copy(rotation);
    mesh.castShadow = true;
    return mesh;
  };

  // ── Engine: flat-six on the rear deck ────────────────────────────────────
  part('engine', material => {
    const node = new THREE.Group();
    const blockHeight = height * .2;
    const y = deck + .05 + blockHeight / 2;
    const z = rear + length * .26;
    node.add(place(new THREE.BoxGeometry(width * .54, .04, length * .17), mount, cx, deck + .02, z));
    node.add(place(new THREE.BoxGeometry(width * .5, blockHeight, length * .13), material, cx, y, z));
    // Two cylinder banks give the silhouette a flat-six read.
    for (const side of [-1, 1]) {
      node.add(place(new THREE.BoxGeometry(width * .17, blockHeight * .52, length * .13), material,
        cx + side * width * .2, y + blockHeight * .72, z));
    }
    node.add(place(new THREE.CylinderGeometry(width * .05, width * .05, length * .13, 12), material,
      cx, y + blockHeight * .3, z + length * .02, new THREE.Euler(Math.PI / 2, 0, 0)));
    return node;
  });

  // ── Transmission: PDK housing at the tail ────────────────────────────────
  part('transmission', material => {
    const node = new THREE.Group();
    const bodyHeight = height * .17;
    const y = deck + .05 + bodyHeight / 2;
    const z = rear + length * .1;
    node.add(place(new THREE.BoxGeometry(width * .34, .04, length * .15), mount, cx, deck + .02, z));
    node.add(place(new THREE.BoxGeometry(width * .3, bodyHeight, length * .1), material, cx, y, z));
    node.add(place(new THREE.CylinderGeometry(width * .11, width * .11, length * .07, 16), material,
      cx, y, z - length * .045, new THREE.Euler(Math.PI / 2, 0, 0)));
    return node;
  });

  // ── Brakes: a disc + caliper beside every wheel ──────────────────────────
  part('brakes', material => {
    const node = new THREE.Group();
    const radius = length * .058;
    for (const x of [-1, 1]) for (const z of [axleFront, axleRear]) {
      const hubX = x * axleX * 1.06;
      node.add(place(new THREE.CylinderGeometry(radius, radius, .05, 24), material,
        hubX, wheelY, z, new THREE.Euler(0, 0, Math.PI / 2)));
      node.add(place(new THREE.BoxGeometry(.06, radius * .8, radius * .5), material,
        hubX + x * .03, wheelY + radius * .35, z - radius * .25));
    }
    return node;
  });

  // ── Suspension: a coil spring over every wheel ───────────────────────────
  part('suspension', material => {
    const node = new THREE.Group();
    const springHeight = height * .3;
    for (const x of [-1, 1]) for (const z of [axleFront, axleRear]) {
      node.add(place(springGeometry(length * .03, springHeight), material,
        x * axleX * .98, y0 + height * .6, z));
    }
    return node;
  });

  // ── Wheels: the car's own rims, tinted from the collection ───────────────
  const rimBase = car.rims.map(rim => rim.color.clone());
  const rimLast = car.rims.map(rim => rim.color.clone());
  const tint = new THREE.Color();

  const level: Record<Zone, number> = { engine: 0, transmission: 0, wheels: 0, brakes: 0, suspension: 0 };
  const flash: Record<Zone, number> = { engine: 0, transmission: 0, wheels: 0, brakes: 0, suspension: 0 };
  let seen = new Set<string>();
  let primed = false;

  const sync = (owned: readonly string[], delta: number) => {
    const next = new Set(owned);
    for (const id of ALL) {
      // The first sync adopts the stored collection silently — only a part the
      // player just drew should flash.
      if (primed && next.has(id) && !seen.has(id)) flash[id] = 1;
      const target = next.has(id) ? 1 : 0;
      level[id] = THREE.MathUtils.lerp(level[id], target, 1 - Math.exp(-delta * 6));
      flash[id] = Math.max(0, flash[id] - delta * 1.5);
    }
    seen = next;
    primed = true;

    for (const id of ALL) {
      if (id === 'wheels') continue;
      const material = materials[id];
      material.color.copy(GREY).lerp(GOLD, level[id]);
      material.opacity = .42 + .58 * level[id];
      material.depthWrite = level[id] > .55;
      material.emissiveIntensity = level[id] * (.3 + flash[id] * 2.4);
    }
    car.rims.forEach((rim, index) => {
      // setConfig() rewrites the rim colour whenever the garage config changes;
      // adopt that as the new base instead of fighting it.
      if (!rim.color.equals(rimLast[index])) rimBase[index].copy(rim.color);
      if (GOLD_HIGHLIGHT) tint.copy(rimBase[index]).multiplyScalar(.42).lerp(GOLD, level.wheels);
      // 金色取消后轮圈不再染金：用配置色本身，未收集时压暗当幽灵。
      else tint.copy(rimBase[index]).multiplyScalar(THREE.MathUtils.lerp(.42, 1, level.wheels));
      rim.color.copy(tint);
      rimLast[index].copy(tint);
      rim.emissive.copy(GOLD);
      rim.emissiveIntensity = level.wheels * (.18 + flash.wheels * 1.8);
    });
  };

  return { group, sync };
}
