// Assembles the module catalogue into one renderable scene graph.
// Three.js only — no React — so the whole scene can be built and inspected head-lessly.
import * as THREE from 'three';
import { Assembly, geo } from './kit';
import { createLampMaterials, createMaterials, createOutlineMaterial, disposeMaterials, type Materials } from './materials';
import { createTextures, type TextureSet } from './textures';
import { DOME, LABELS, LAMPS, LAMP_POLE_H, sections, type BuildContext, type LabelSpec, type LampRuntime, type ModuleSpec } from './structures';
import { CAR } from './vehicle';

export type ModuleHandle = {
  id: string;
  name: string;
  note: string;
  channel: string;
  sectionId: string;
  sectionLabel: string;
  spec: ModuleSpec;
  group: THREE.Group;
  box: THREE.Box3;
  size: [number, number, number];
  centre: THREE.Vector3;
  offset: THREE.Vector3;
  parts: number;
  materials: string[];
  outline: THREE.Mesh;
  pick: THREE.Mesh;
  lampIndex?: number;
};

export type Diorama = {
  root: THREE.Group;
  modules: ModuleHandle[];
  byId: Map<string, ModuleHandle>;
  labels: LabelSpec[];
  lamps: LampRuntime[];
  lights: { key: THREE.DirectionalLight; rim: THREE.DirectionalLight; hemi: THREE.HemisphereLight };
  textures: TextureSet;
  materials: Materials;
  stats: { parts: number; triangles: number; drawCalls: number };
  applyLampIntensities: () => void;
  setLamp: (index: number, on: boolean) => void;
  lampOn: (index: number) => boolean;
  outlineFor: (handle: ModuleHandle | null, selected: boolean) => void;
  update: (elapsed: number) => void;
  dispose: () => void;
};

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function trianglesOf(geometry: THREE.BufferGeometry) {
  const index = geometry.getIndex();
  return index ? index.count / 3 : geometry.getAttribute('position').count / 3;
}

export function buildDiorama(): Diorama {
  const textures = createTextures();
  const materials = createMaterials(textures);
  const outlineHover = createOutlineMaterial('#6fe3ff', 0.017);
  const outlineSelect = createOutlineMaterial('#ff9a2e', 0.022);
  const pickMaterial = new THREE.MeshBasicMaterial();
  pickMaterial.visible = false; // raycastable, never drawn

  const lamps: LampRuntime[] = LAMPS.map((spec) => {
    const set = createLampMaterials(textures);
    return { spec, lens: set.lens, beam: set.beam, pool: set.pool, spot: null, intensity: { value: 1 } };
  });
  const lampVisuals: Array<{ beam: THREE.Mesh; pool: THREE.Mesh }> = [];
  const ctx: BuildContext = { tex: textures, mats: materials, lamps };

  const root = new THREE.Group();
  root.name = 'selene';
  const modules: ModuleHandle[] = [];

  for (const section of sections()) {
    for (const spec of section.modules) {
      const assembly = new Assembly();
      spec.build(assembly, ctx);
      const built = assembly.build(materials);

      const group = new THREE.Group();
      group.name = spec.id;
      group.userData.moduleId = spec.id;
      group.add(built.group);

      const cast = spec.shadow === 'cast';
      const receive = spec.shadow !== 'none';
      built.group.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
        mesh.userData.moduleId = spec.id;
        // The module already has a coarse pick mesh; avoid testing every rendered triangle too.
        mesh.raycast = () => undefined;
      });

      const outline = new THREE.Mesh(built.outline, outlineHover);
      outline.visible = false;
      outline.raycast = () => undefined;
      outline.userData.outline = true;
      group.add(outline);

      const pick = new THREE.Mesh(built.pick, pickMaterial);
      pick.userData.moduleId = spec.id;
      group.add(pick);

      const centre = built.box.getCenter(new THREE.Vector3());
      const size = built.box.getSize(new THREE.Vector3());
      const lampIndex = LAMPS.findIndex((lamp) => lamp.id === spec.id);
      modules.push({
        id: spec.id, name: spec.name, note: spec.note, channel: spec.channel,
        sectionId: section.id, sectionLabel: section.label, spec,
        group, box: built.box, size: [size.x, size.y, size.z],
        centre, offset: new THREE.Vector3(...spec.offset),
        parts: built.parts, materials: built.materials,
        outline, pick,
        lampIndex: lampIndex >= 0 ? lampIndex : undefined,
      });
      if (lampIndex < 0) group.position.set(0, 0, 0);
      root.add(group);
    }
  }

  // ---------------------------------------------------------------- fixtures
  LAMPS.forEach((spec, index) => {
    const lamp = lamps[index];
    const [ox, oz] = spec.origin;
    const az = Math.atan2(-ox, -oz);
    const head = new THREE.Vector3(ox + Math.sin(az) * 0.14, LAMP_POLE_H + 0.2, oz + Math.cos(az) * 0.14);
    const aim = new THREE.Vector3(spec.aim[0], 0, spec.aim[2]);
    const dir = aim.clone().sub(head);
    const length = dir.length();
    const cone = geo.cone(length * 0.3, length, 30);
    const beam = new THREE.Mesh(cone, lamp.beam);
    beam.position.copy(head).addScaledVector(dir, 0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate().normalize());
    beam.renderOrder = 3;
    beam.raycast = () => undefined;
    root.add(beam);

    const pool = new THREE.Mesh(geo.plane(4.2, 4.2), lamp.pool);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(aim.x, 0.02, aim.z);
    pool.renderOrder = 2;
    pool.raycast = () => undefined;
    root.add(pool);
    lampVisuals.push({ beam, pool });

    if (spec.live) {
      const spot = new THREE.SpotLight('#ffd9a2', 70, 0, 0.55, 0.72, 2);
      spot.position.copy(head);
      spot.target.position.set(aim.x, 0, aim.z);
      root.add(spot);
      root.add(spot.target);
      lamp.spot = spot;
    }
  });

  // ------------------------------------------------------------ environment
  const rockGeometry = geo.rock(0.5, 9);
  const rockCount = 76;
  const rocks = new THREE.InstancedMesh(rockGeometry, materials.rock, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.raycast = () => undefined;
  const random = seeded(20070407);
  const keepOut: Array<[number, number, number]> = [
    [DOME.x, DOME.z, 3.3],
    ...LAMPS.map((lamp) => [lamp.origin[0], lamp.origin[1], 0.7] as [number, number, number]),
    [4.0, 2.35, 1.4], [-4.5, -2.5, 1.4], [4.4, 2.5, 1.1], [3.0, 3.1, 1.0],
    [CAR.x, CAR.z, 3.1],
  ];
  const dummy = new THREE.Object3D();
  let placed = 0, guard = 0;
  while (placed < rockCount && guard < rockCount * 40) {
    guard += 1;
    const x = -5.5 + random() * 11;
    const z = -3.7 + random() * 7.4;
    if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
    if (z > 0.9 && z < 1.7 && x < -0.6 && x > -4.8) continue; // barrier row
    const scale = 0.08 + random() * random() * 0.42;
    dummy.position.set(x, scale * 0.28 - 0.02, z);
    dummy.rotation.set(random() * 0.4, random() * Math.PI * 2, random() * 0.4);
    dummy.scale.set(scale * (0.8 + random() * 0.5), scale * (0.5 + random() * 0.4), scale * (0.8 + random() * 0.5));
    dummy.updateMatrix();
    rocks.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  rocks.count = placed;
  root.add(rocks);

  // fake contact occlusion — the cheapest way to make the hardware sit on the deck
  const aoBlobs: Array<[number, number, number, number]> = [
    [DOME.x, DOME.z, 7.0, 0],
    ...LAMPS.map((lamp) => [lamp.origin[0], lamp.origin[1], 1.3, 0] as [number, number, number, number]),
    [-2.4, 1.5, 3.4, 0.2], [4.4, 2.5, 2.0, 0.5], [3.0, 3.1, 1.9, -0.4],
    [-1.5, -2.7, 5.0, 0.9], [3.6, -1.2, 4.4, 1.7],
    [CAR.x, CAR.z, 6.6, CAR.rot],
  ];
  for (const [x, z, size, rot] of aoBlobs) {
    const blob = new THREE.Mesh(geo.plane(size, size), materials.aoBlob);
    blob.rotation.set(-Math.PI / 2, 0, rot);
    blob.position.set(x, 0.012, z);
    blob.renderOrder = 1;
    blob.raycast = () => undefined;
    root.add(blob);
  }
  // barrier row shadow band
  const band = new THREE.Mesh(geo.plane(4.6, 1.4), materials.aoBlob);
  band.rotation.set(-Math.PI / 2, 0, 0.06);
  band.position.set(-2.9, 0.013, 1.5);
  band.renderOrder = 1;
  band.raycast = () => undefined;
  root.add(band);

  // ---------------------------------------------------------------- lighting
  const key = new THREE.DirectionalLight('#fff3e4', 2.7);
  key.position.set(9.5, 13.5, 8.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 38;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0007;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 2.2;
  root.add(key);
  root.add(key.target);

  const rim = new THREE.DirectionalLight('#9ec6ea', 0.75);
  rim.position.set(-10.5, 6.5, -11);
  root.add(rim);
  root.add(rim.target);

  const hemi = new THREE.HemisphereLight('#8296ad', '#0d1015', 0.42);
  root.add(hemi);

  const byId = new Map(modules.map((module) => [module.id, module]));

  const applyLampIntensities = () => {
    lamps.forEach((lamp, index) => {
      const value = lamp.intensity.value;
      lamp.lens.emissiveIntensity = 0.12 + 3.4 * value;
      lamp.beam.opacity = 0.07 * value;
      lamp.pool.opacity = 0.54 * value;
      if (lamp.spot) lamp.spot.intensity = 74 * value;
      const visuals = lampVisuals[index];
      if (visuals) {
        visuals.beam.visible = value > 0.03;
        visuals.pool.visible = value > 0.03;
      }
    });
  };
  applyLampIntensities();

  const stats = { parts: 0, triangles: 0, drawCalls: 0 };
  root.traverse((object) => {
    const mesh = object as THREE.Mesh & { isInstancedMesh?: boolean };
    if (!mesh.isMesh) return;
    stats.drawCalls += 1;
    const geometry = mesh.geometry;
    if (!geometry) return;
    const count = mesh.isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
    stats.triangles += trianglesOf(geometry) * count;
  });
  stats.parts = modules.reduce((total, mod) => total + mod.parts, 0);

  return {
    root,
    modules,
    byId,
    labels: LABELS,
    lamps,
    lights: { key, rim, hemi },
    textures,
    materials,
    stats,
    applyLampIntensities,
    setLamp: (index, on) => {
      if (lamps[index]) lamps[index].intensity.value = on ? 1 : 0;
    },
    lampOn: (index) => (lamps[index] ? lamps[index].intensity.value > 0.5 : false),
    outlineFor: (handle, selected) => {
      for (const mod of modules) {
        if (!handle || mod.id !== handle.id) mod.outline.visible = false;
      }
      if (handle) {
        handle.outline.visible = true;
        handle.outline.material = selected ? outlineSelect : outlineHover;
      }
    },
    update: (elapsed) => {
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.55);
      (materials.red as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + 2.8 * pulse;
      (materials.amber as THREE.MeshStandardMaterial).emissiveIntensity = 3.0 + 0.45 * Math.sin(elapsed * 0.8);
      (materials.cyan as THREE.MeshStandardMaterial).emissiveIntensity = 3.3 + 0.35 * Math.sin(elapsed * 2.1);
      (materials.warm as THREE.MeshStandardMaterial).emissiveIntensity = 2.9 + 0.3 * Math.sin(elapsed * 6.1) * Math.sin(elapsed * 1.3);
    },
    dispose: () => {
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
      });
      outlineHover.dispose();
      outlineSelect.dispose();
      pickMaterial.dispose();
      lamps.forEach((lamp) => {
        lamp.beam.dispose();
        lamp.pool.dispose();
        lamp.lens.dispose();
      });
      disposeMaterials(materials);
      textures.dispose();
    },
  };
}
