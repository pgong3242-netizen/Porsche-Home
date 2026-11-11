// Module catalogue for the SELENE // SITE 07 diorama.
// Each module is an independent sub-assembly: it merges into a handful of meshes,
// can be hovered / selected / exploded on its own, and carries its own metadata.
import * as THREE from 'three';
import { Assembly, axisTowards, faceTowards, geo, radial, turn } from './kit';
import type { Materials } from './materials';
import type { TextureSet } from './textures';
import { buildCarBody, buildCarWheels, CAR } from './vehicle';

const TAU = Math.PI * 2;

export const PLATFORM = { w: 11.6, d: 8.0, h: 0.68 };
export const DOME = { x: -1.7, z: -0.55, r: 2.45, baseH: 1.05 };
export const LAMP_POLE_H = 2.72;

export type LampSpec = {
  id: string;
  name: string;
  origin: [number, number];
  head: [number, number, number];
  aim: [number, number, number];
  live: boolean;
};

// Six work lamps around the deck; the three front fixtures carry a real spotlight.
export const LAMPS: LampSpec[] = [
  { id: 'lamp-1', name: '作业照明 01', origin: [-4.95, -3.2], head: [0.05, LAMP_POLE_H, 0.34], aim: [-2.1, 0, -0.4], live: true },
  { id: 'lamp-2', name: '作业照明 02', origin: [4.95, -3.2], head: [0.05, LAMP_POLE_H, 0.34], aim: [1.6, 0, -1.2], live: true },
  { id: 'lamp-3', name: '作业照明 03', origin: [4.95, 3.25], head: [0.05, LAMP_POLE_H, 0.34], aim: [2.6, 0, 0.6], live: false },
  { id: 'lamp-4', name: '作业照明 04', origin: [-4.95, 3.25], head: [0.05, LAMP_POLE_H, 0.34], aim: [-2.6, 0, 1.0], live: true },
  { id: 'lamp-5', name: '作业照明 05', origin: [0.35, -3.5], head: [0.05, LAMP_POLE_H - 0.25, 0.32], aim: [-0.4, 0, -1.6], live: false },
  { id: 'lamp-6', name: '作业照明 06', origin: [-0.2, 3.55], head: [0.05, LAMP_POLE_H - 0.25, 0.32], aim: [-0.9, 0, 1.6], live: false },
];

export type LampRuntime = {
  spec: LampSpec;
  lens: THREE.MeshStandardMaterial;
  beam: THREE.MeshBasicMaterial;
  pool: THREE.MeshBasicMaterial;
  spot: THREE.SpotLight | null;
  intensity: { value: number };
};

export type BuildContext = { tex: TextureSet; mats: Materials; lamps: LampRuntime[] };

export type ModuleSpec = {
  id: string;
  name: string;
  note: string;
  channel: string;
  offset: [number, number, number];
  shadow: 'cast' | 'receive' | 'none';
  build: (a: Assembly, ctx: BuildContext) => void;
};

export type SectionSpec = { id: string; label: string; modules: ModuleSpec[] };

export type LabelSpec = { id: string; title: string; sub: string; anchor: [number, number, number] };

const W = PLATFORM.w, D = PLATFORM.d, H = PLATFORM.h;
const R = DOME.r, BH = DOME.baseH;

// ---------------------------------------------------------------- platform

// One skirt face: panels, dividers, fasteners, optional louvres and service kit.
function skirtFace(a: Assembly, frame: Parameters<Assembly['push']>[0], width: number, opts: {
  panels: number; vents?: number[]; hazard?: boolean; label?: string; lamp?: number[];
}) {
  const height = 0.5, depth = 0.16, gap = 0.34;
  const panelW = (width - gap * (opts.panels + 1)) / opts.panels;
  a.push(frame);
  for (let i = 0; i < opts.panels; i++) {
    const x = -width / 2 + gap + panelW / 2 + i * (panelW + gap);
    a.add(geo.box(panelW, height, depth, 0.02), 'graphite', { pos: [x, 0, 0] });
    if (opts.vents && opts.vents.includes(i)) {
      a.push({ pos: [x, 0, depth / 2 + 0.015] });
      a.vent(panelW - 0.34, height - 0.16, 5, 'anodized', 'graphite');
      a.pop();
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      a.add(geo.hex(0.024, 0.032), 'steel', { pos: [x + sx * (panelW / 2 - 0.1), sy * (height / 2 - 0.09), depth / 2 + 0.018], quat: axisTowards(0, 0, 1) });
    }
  }
  for (let i = 0; i <= opts.panels; i++) {
    const x = -width / 2 + gap / 2 + i * (panelW + gap);
    a.add(geo.box(gap * 0.62, height + 0.05, depth + 0.05, 0.02), 'anodized', { pos: [x, 0, 0.01] });
    a.add(geo.box(gap * 0.5, 0.05, depth + 0.07, 0.01), 'steel', { pos: [x, -height / 2 - 0.02, 0.012] });
  }
  if (opts.hazard) {
    a.add(geo.box(2.5, height - 0.02, 0.04, 0.02), 'graphite', { pos: [width * 0.3, 0, depth / 2 + 0.03] });
    a.add(geo.plane(2.34, 0.4), 'hazard', { pos: [width * 0.3, 0, depth / 2 + 0.06] });
  }
  if (opts.label) {
    a.add(geo.box(2.4, 0.14, 0.04, 0.01), 'orange', { pos: [-width * 0.28, height / 2 - 0.09, depth / 2 + 0.03] });
  }
  if (opts.lamp) {
    for (const x of opts.lamp) {
      a.add(geo.box(0.16, 0.1, 0.06, 0.015), 'anodized', { pos: [x, -height / 2 + 0.06, depth / 2 + 0.04] });
      a.add(geo.disc(0.032, 14), 'amber', { pos: [x, -height / 2 + 0.06, depth / 2 + 0.075] });
    }
  }
  a.pop();
}

function buildDeck(a: Assembly) {
  // structural slab (anodised) with four machined deck plates on top of it
  a.add(geo.box(W, H, D, 0.05), 'anodized', { pos: [0, -0.045 - H / 2, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    a.add(geo.box(5.4, 0.045, 3.6, 0.03), 'graphite', { pos: [sx * 2.85, -0.0225, sz * 1.9] });
  }
  // recessed seam liners + flush perimeter trim
  a.add(geo.box(W - 0.5, 0.05, 0.14, 0.01), 'steel', { pos: [0, -0.02, 0] });
  a.add(geo.box(0.14, 0.05, D - 0.5, 0.01), 'steel', { pos: [0, -0.02, 0] });
  for (const sz of [-1, 1]) a.add(geo.box(W - 0.3, 0.06, 0.26, 0.02), 'steel', { pos: [0, -0.03, sz * (D / 2 - 0.13)] });
  for (const sx of [-1, 1]) a.add(geo.box(0.26, 0.06, D - 0.3, 0.02), 'steel', { pos: [sx * (W / 2 - 0.13), -0.03, 0] });
  // fastener rows along both long edges and both short edges
  const longRow: Array<[number, number, number]> = [];
  for (let x = -5.2; x <= 5.21; x += 0.8) for (const sz of [-1, 1]) longRow.push([x, -0.03, sz * (D / 2 - 0.13)]);
  for (let z = -3.2; z <= 3.21; z += 0.8) for (const sx of [-1, 1]) longRow.push([sx * (W / 2 - 0.13), -0.03, z]);
  a.studs(longRow, 0.026, 0.034);
  // two recessed service hatches with hinges and lifting bolts
  for (const [hx, hz, rot] of [[4.0, 2.35, 0.2], [-4.5, -2.5, -0.35]] as Array<[number, number, number]>) {
    a.add(geo.box(1.3, 0.05, 1.05, 0.02), 'anodized', { pos: [hx, -0.012, hz], rot: [0, rot, 0] });
    a.add(geo.box(1.16, 0.03, 0.92, 0.02), 'steel', { pos: [hx, -0.03, hz], rot: [0, rot, 0] });
    a.add(geo.box(0.9, 0.012, 0.62, 0.006), 'graphite', { pos: [hx, -0.038, hz], rot: [0, rot, 0] });
    a.studs([[hx - 0.42, -0.036, hz - 0.34], [hx + 0.42, -0.036, hz - 0.34], [hx - 0.42, -0.036, hz + 0.34], [hx + 0.42, -0.036, hz + 0.34]], 0.022, 0.026);
    for (const off of [-0.3, 0.3]) {
      a.add(geo.box(0.12, 0.06, 0.1, 0.015), 'steel', { pos: [hx + off, 0.005, hz - 0.56], rot: [0, rot, 0] });
      a.add(geo.cyl(0.018, 0.018, 0.2, 8), 'steel', { pos: [hx + off, 0.005, hz - 0.56], rot: [0, rot, Math.PI / 2] });
    }
    a.add(geo.box(0.3, 0.02, 0.08, 0.008), 'orange', { pos: [hx, -0.01, hz + 0.42], rot: [0, rot, 0] });
    // deck drain grille beside each hatch
    a.push({ pos: [hx - 1.5, -0.022, hz + 0.5], rot: [-Math.PI / 2, 0, 0] });
    a.vent(0.72, 0.3, 5, 'anodized', 'graphite');
    a.pop();
  }
  // tie-down rings at the four corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    a.push({ pos: [sx * 5.3, -0.03, sz * 3.5] });
    a.add(geo.box(0.26, 0.03, 0.26, 0.01), 'steel');
    a.add(geo.torus(0.075, 0.019, 6, 16), 'steel', { pos: [0, 0.04, 0], rot: [Math.PI / 2, 0, 0] });
    a.pop();
  }
  // raised cable ducts down both long edges, with clamps and edge lighting
  for (const sx of [-1, 1]) {
    a.add(geo.box(0.24, 0.1, D - 1.4, 0.02), 'graphite', { pos: [sx * 5.42, 0.05, 0] });
    a.add(geo.box(0.26, 0.02, D - 1.5, 0.008), 'anodized', { pos: [sx * 5.42, 0.11, 0] });
    for (const z of [-3, 0, 3]) {
      a.add(geo.box(0.3, 0.14, 0.16, 0.02), 'steel', { pos: [sx * 5.42, 0.06, z] });
      a.add(geo.cyl(0.024, 0.024, 0.05, 8), 'steel', { pos: [sx * 5.42, 0.14, z] });
    }
    a.add(geo.box(0.07, 0.03, 1.9, 0.01), 'amber', { pos: [sx * 5.42, 0.125, -1.4] });
  }
  // guard rail on the left-hand edge
  for (const z of [-2.8, 0.7]) {
    a.push({ pos: [-5.15, 0, z] });
    a.add(geo.box(0.16, 0.04, 0.16, 0.01), 'steel', { pos: [0, 0.02, 0] });
    a.add(geo.cyl(0.028, 0.032, 0.92, 12), 'steel', { pos: [0, 0.48, 0] });
    a.add(geo.box(0.1, 0.16, 0.1, 0.02), 'anodized', { pos: [0, 0.9, 0] });
    a.pop();
  }
  a.add(geo.tube([[-5.15, 0.92, -2.8], [-5.15, 0.95, -1.05], [-5.15, 0.92, 0.7]], 0.026, 20, 8), 'steel');
  a.add(geo.tube([[-5.15, 0.55, -2.8], [-5.15, 0.56, -1.05], [-5.15, 0.55, 0.7]], 0.018, 20, 6), 'anodized');
}

function buildUnderframe(a: Assembly) {
  a.add(geo.box(W - 1.4, 0.56, D - 1.4, 0.04), 'anodized', { pos: [0, -1.005, 0] });
  for (const sz of [-1, 1]) a.add(geo.box(W - 1.6, 0.28, 0.36, 0.03), 'graphite', { pos: [0, -0.76, sz * 2.4] });
  a.add(geo.box(0.36, 0.28, D - 1.6, 0.03), 'graphite', { pos: [0, -0.76, 0] });
  for (const sx of [-1, 1]) {
    a.add(geo.tube([[sx * 4.0, -0.78, -2.6], [sx * 2.0, -1.28, -1.2]], 0.034, 4, 8), 'steel');
    a.add(geo.tube([[sx * 4.0, -0.78, 2.6], [sx * 2.0, -1.28, 1.2]], 0.034, 4, 8), 'steel');
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    a.add(geo.box(1.08, 0.18, 1.08, 0.03), 'steel', { pos: [sx * 4.2, -1.37, sz * 2.6] });
    a.add(geo.box(0.86, 0.06, 0.86, 0.02), 'graphite', { pos: [sx * 4.2, -1.26, sz * 2.6] });
    a.studs([[sx * 4.2 - 0.34, -1.27, sz * 2.6 - 0.34], [sx * 4.2 + 0.34, -1.27, sz * 2.6 - 0.34], [sx * 4.2 - 0.34, -1.27, sz * 2.6 + 0.34], [sx * 4.2 + 0.34, -1.27, sz * 2.6 + 0.34]], 0.026, 0.034);
  }
  for (const sz of [-1, 1]) for (const i of [-1, 0, 1]) a.add(geo.box(3.1, 0.34, 0.1, 0.02), 'graphite', { pos: [i * 3.3, -1.0, sz * 3.28] });
  // cable tray and loom
  a.add(geo.box(8.6, 0.16, 0.54, 0.02), 'graphite', { pos: [0, -0.7, 3.28] });
  a.add(geo.tube([[-4.2, -0.62, 3.28], [-2, -0.55, 3.33], [0, -0.62, 3.28], [2, -0.55, 3.33], [4.2, -0.62, 3.28]], 0.05, 56, 8), 'rubber');
  a.add(geo.tube([[-4.2, -0.58, 3.12], [-1.4, -0.5, 3.16], [1.4, -0.5, 3.16], [4.2, -0.58, 3.12]], 0.038, 56, 8), 'rubber');
  for (const x of [-3, 0, 3]) a.add(geo.box(0.14, 0.2, 0.2, 0.02), 'steel', { pos: [x, -0.62, 3.28] });
  // service riser from the deck down into the tray
  a.add(geo.tube([[-1.1, 0.0, 1.6], [-1.15, -0.5, 2.6], [-1.3, -0.72, 3.3]], 0.07, 32, 8), 'rubber');
  a.add(geo.tube([[-0.85, 0.0, 1.6], [-0.9, -0.45, 2.55], [-1.0, -0.7, 3.25]], 0.05, 32, 8), 'rubber');
  for (const y of [-0.2, -0.5]) a.add(geo.box(0.26, 0.08, 0.12, 0.015), 'steel', { pos: [-1.15, y, 2.35] });
}

function buildSignage(a: Assembly) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * (W / 2 - 0.16), pz = sz * (D / 2 - 0.16);
    a.add(geo.box(0.3, 1.0, 0.3, 0.03), 'steel', { pos: [px, 0.5, pz] });
    a.add(geo.box(0.36, 0.08, 0.36, 0.02), 'anodized', { pos: [px, 1.02, pz] });
    a.add(geo.box(0.22, 0.05, 0.22, 0.02), 'anodized', { pos: [px, 1.07, pz] });
    for (const y of [0.22, 0.5, 0.78]) {
      a.add(geo.hex(0.03, 0.036), 'steel', { pos: [px, y, pz + 0.16], quat: axisTowards(0, 0, 1) });
      a.add(geo.hex(0.03, 0.036), 'steel', { pos: [px, y, pz - 0.16], quat: axisTowards(0, 0, -1) });
    }
    a.push({ pos: [px + sx * 0.16, 0.9, pz], quat: turn(sx * Math.PI / 2) });
    a.add(geo.disc(0.04, 16), 'cyan');
    a.pop();
  }
  // main nameplate
  a.push({ pos: [-2.3, -0.34, D / 2 + 0.09] });
  a.add(geo.box(4.7, 0.66, 0.1, 0.02), 'anodized');
  a.add(geo.box(4.5, 0.5, 0.03, 0.01), 'graphite', { pos: [0, 0, 0.055] });
  a.add(geo.plane(4.36, 0.3), 'signLight', { pos: [0, 0.045, 0.075] });
  a.add(geo.plane(1.5, 0.09), 'orange', { pos: [0, -0.2, 0.075] });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) a.add(geo.hex(0.026, 0.034), 'steel', { pos: [sx * 2.24, sy * 0.28, 0.06], quat: axisTowards(0, 0, 1) });
  for (const x of [-2.0, -2.12]) a.add(geo.disc(0.045, 16), 'amber', { pos: [x, -0.24, 0.075] });
  a.pop();
}

function buildSkirtFront(a: Assembly) {
  skirtFace(a, { pos: [0, -0.36, D / 2 + 0.02] }, W - 0.3, { panels: 5, vents: [1, 3], hazard: true, label: 'front', lamp: [3.3, 3.5] });
}

function buildSkirtBack(a: Assembly) {
  skirtFace(a, { pos: [0, -0.36, -(D / 2 + 0.02)], quat: turn(Math.PI) }, W - 0.3, { panels: 5, vents: [0, 2, 4], label: 'back' });
  // rear equipment boxes bolted to the skirt
  for (const x of [-3.6, 2.9]) {
    a.push({ pos: [x, -0.34, -(D / 2 + 0.2)] });
    a.add(geo.box(1.5, 0.66, 0.36, 0.03), 'graphite');
    a.add(geo.box(1.42, 0.08, 0.38, 0.02), 'anodized', { pos: [0, 0.29, 0.01] });
    for (let i = 0; i < 7; i++) a.add(geo.box(0.1, 0.42, 0.03, 0.008), 'alu', { pos: [-0.6 + i * 0.2, 0, -0.19] });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) a.add(geo.hex(0.024, 0.03), 'steel', { pos: [sx * 0.66, sy * 0.26, -0.2], quat: axisTowards(0, 0, -1) });
    a.add(geo.cyl(0.05, 0.05, 0.12, 12), 'rubber', { pos: [0.62, -0.22, -0.24], rot: [Math.PI / 2, 0, 0] });
    a.pop();
  }
}

function buildSkirtRight(a: Assembly) {
  skirtFace(a, { pos: [W / 2 + 0.02, -0.36, 0], quat: turn(Math.PI / 2) }, D - 0.3, { panels: 3, vents: [1], lamp: [1.2] });
  // service ladder up to the deck
  a.push({ pos: [W / 2 + 0.14, 0.02, 3.1], quat: turn(Math.PI / 2) });
  for (const x of [-0.24, 0.24]) {
    a.add(geo.cyl(0.028, 0.028, 1.5, 10), 'steel', { pos: [x, -0.74, 0.1] });
    a.add(geo.box(0.07, 0.05, 0.2, 0.012), 'steel', { pos: [x, 0.0, 0.06] });
  }
  for (let i = 0; i < 6; i++) a.add(geo.cyl(0.016, 0.016, 0.5, 8), 'steel', { pos: [0, -0.12 - i * 0.24, 0.1], rot: [0, 0, Math.PI / 2] });
  a.pop();
}

function buildSkirtLeft(a: Assembly) {
  skirtFace(a, { pos: [-(W / 2 + 0.02), -0.36, 0], quat: turn(-Math.PI / 2) }, D - 0.3, { panels: 3, vents: [0, 2], label: 'left', lamp: [-1.1] });
}

const platformModules: ModuleSpec[] = [
  { id: 'platform-deck', name: '平台甲板', note: '四块可拆甲板板 + 内嵌缝线 + 检修口', channel: '结构', offset: [0, 1.7, 0], shadow: 'receive', build: buildDeck },
  { id: 'platform-underframe', name: '平台底架', note: '纵梁 / 支脚 / 桥架 + 电缆束', channel: '结构', offset: [0, -1.65, 0], shadow: 'receive', build: buildUnderframe },
  { id: 'platform-skirt-front', name: '前裙板组件', note: '5 块模块化裙板 + 危险斜纹 + 检修灯', channel: '围护', offset: [0, 0.5, 1.6], shadow: 'receive', build: buildSkirtFront },
  { id: 'platform-skirt-back', name: '后裙板组件', note: '5 块裙板 + 百叶散热 + 设备箱', channel: '围护', offset: [0, 0.5, -1.6], shadow: 'receive', build: buildSkirtBack },
  { id: 'platform-skirt-right', name: '右侧裙板', note: '裙板 + 维护爬梯', channel: '围护', offset: [1.6, 0.35, 0], shadow: 'receive', build: buildSkirtRight },
  { id: 'platform-skirt-left', name: '左侧裙板', note: '裙板 + 双组百叶 + 检修口', channel: '围护', offset: [-1.6, 0.35, 0], shadow: 'receive', build: buildSkirtLeft },
  { id: 'platform-signage', name: '角柱与铭牌', note: '四角结构柱 + SELENE // SITE 07 铭牌 + 指示', channel: '仪表', offset: [-1.9, 1.0, 0.9], shadow: 'cast', build: buildSignage },
];

// ------------------------------------------------------------------- dome

function buildDomeBase(a: Assembly) {
  a.add(geo.cyl(R, R, BH, 72), 'ceramic', { pos: [0, BH / 2, 0] });
  a.add(geo.ring(R - 0.09, R + 0.07, 0.16, 72), 'anodized', { pos: [0, 0.08, 0] });
  a.add(geo.ring(R - 0.1, R + 0.09, 0.18, 72), 'anodized', { pos: [0, BH - 0.07, 0] });
  a.add(geo.ring(R - 0.005, R + 0.02, 0.05, 72), 'graphite', { pos: [0, 0.52, 0] });
  a.add(geo.ring(R - 0.005, R + 0.025, 0.17, 72), 'orange', { pos: [0, 0.34, 0] });
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * TAU;
    a.add(geo.box(0.11, BH - 0.4, 0.075, 0.018), 'anodized', { pos: radial(ang, R + 0.02, BH / 2), quat: turn(ang) });
  }
  a.studs([0, 1, 2, 3].map((i) => radial((i / 4) * TAU + Math.PI / 4, R - 0.02, 0.18)).map(([x, y, z]) => [x, y, z] as [number, number, number]), 0.03, 0.04);
  // eight portholes with bolt rings
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU + 0.39;
    const nx = Math.sin(ang), nz = Math.cos(ang);
    a.add(geo.ring(0.16, 0.235, 0.2, 28), 'anodized', { pos: radial(ang, R - 0.02, 0.62), quat: axisTowards(nx, 0, nz) });
    a.add(geo.disc(0.165, 28), 'smoked', { pos: radial(ang, R + 0.045, 0.62), quat: faceTowards(nx, 0, nz) });
    a.add(geo.ring(0.05, 0.075, 0.05, 16), 'steel', { pos: radial(ang, R + 0.06, 0.62), quat: axisTowards(nx, 0, nz) });
    for (let k = 0; k < 4; k++) {
      const ta = (k / 4) * TAU + Math.PI / 4;
      const tanX = Math.cos(ang), tanZ = -Math.sin(ang);
      const ox = tanX * Math.sin(ta) * 0.205, oz = tanZ * Math.sin(ta) * 0.205, oy = Math.cos(ta) * 0.205;
      a.add(geo.hex(0.019, 0.026), 'steel', { pos: [Math.sin(ang) * (R - 0.01) + ox, 0.62 + oy, Math.cos(ang) * (R - 0.01) + oz], quat: axisTowards(nx, 0, nz) });
    }
  }
  // shell-mounted equipment boxes
  for (const ang of [2.5, 4.3]) {
    a.push({ pos: radial(ang, R - 0.05, 0.72), quat: turn(ang) });
    a.add(geo.box(0.72, 0.5, 0.3, 0.03), 'graphite', { pos: [0, 0, 0.08] });
    a.add(geo.box(0.78, 0.09, 0.34, 0.02), 'anodized', { pos: [0, 0.26, 0.1] });
    for (let i = 0; i < 5; i++) a.add(geo.box(0.08, 0.34, 0.03, 0.008), 'alu', { pos: [-0.26 + i * 0.13, 0, 0.24] });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) a.add(geo.hex(0.022, 0.03), 'steel', { pos: [sx * 0.3, sy * 0.2, 0.22], quat: axisTowards(0, 0, 1) });
    a.pop();
  }
  // conduit pair heading down into the platform
  a.add(geo.tube([[0.6, 0.9, R - 0.6], [0.75, 0.4, R + 0.1], [0.9, 0.06, R + 0.7]], 0.05, 24, 8), 'rubber');
  a.add(geo.tube([[0.85, 0.95, R - 0.55], [1.0, 0.4, R + 0.15], [1.15, 0.06, R + 0.72]], 0.038, 24, 8), 'rubber');
  for (const z of [R + 0.3, R + 0.6]) a.add(geo.box(0.14, 0.07, 0.16, 0.015), 'steel', { pos: [0.85, 0.14, z] });
}

function buildDomeShell(a: Assembly) {
  a.add(geo.dome(R, 80, 40), 'ceramic', { pos: [0, BH, 0] });
  for (const deg of [17, 34, 51, 68]) {
    const th = (deg * Math.PI) / 180;
    const rr = Math.cos(th) * R;
    a.add(geo.ring(rr - 0.1, rr + 0.05, 0.085, 80), 'anodized', { pos: [0, BH + Math.sin(th) * R, 0] });
  }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU;
    const points: Array<[number, number, number]> = [];
    for (let k = 0; k <= 14; k++) {
      const th = (k / 14) * (Math.PI / 2);
      points.push(radial(ang, Math.cos(th) * (R + 0.012), BH + Math.sin(th) * (R + 0.012)));
    }
    a.add(geo.tube(points, 0.036, 14, 8), 'anodized');
  }
  // apex plant room with a radial louvre pattern
  const apex = BH + R;
  a.add(geo.cyl(0.8, 0.9, 0.28, 44), 'anodized', { pos: [0, apex + 0.07, 0] });
  a.add(geo.ring(0.82, 0.92, 0.08, 44), 'steel', { pos: [0, apex + 0.22, 0] });
  a.add(geo.cyl(0.68, 0.68, 0.05, 36), 'graphite', { pos: [0, apex + 0.245, 0] });
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * TAU;
    a.add(geo.box(0.09, 0.03, 0.62, 0.01), i % 2 ? 'orange' : 'anodized', { pos: radial(ang, 0.34, apex + 0.275), quat: turn(ang) });
  }
  // service hatch and orange identification plates tangent to the shell
  for (const [ang, th, kind] of [[0.9, 0.52, 'hatch'], [2.1, 0.62, 'plate'], [3.9, 0.58, 'plate'], [5.2, 0.5, 'plate']] as Array<[number, number, string]>) {
    const n: [number, number, number] = [Math.sin(ang) * Math.cos(th), Math.sin(th), Math.cos(ang) * Math.cos(th)];
    const pos: [number, number, number] = [n[0] * (R + 0.015), BH + n[1] * (R + 0.015), n[2] * (R + 0.015)];
    a.push({ pos, quat: faceTowards(n[0], n[1], n[2]) });
    if (kind === 'hatch') {
      a.add(geo.box(0.66, 0.56, 0.05, 0.02), 'anodized');
      a.add(geo.box(0.54, 0.44, 0.03, 0.015), 'steel', { pos: [0, 0, 0.035] });
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) a.add(geo.hex(0.02, 0.028), 'steel', { pos: [sx * 0.28, sy * 0.22, 0.045], quat: axisTowards(0, 0, 1) });
    } else {
      a.add(geo.box(0.44, 0.62, 0.03, 0.012), 'orange');
      a.add(geo.box(0.32, 0.05, 0.012, 0.006), 'graphite', { pos: [0, 0.2, 0.018] });
      a.add(geo.box(0.32, 0.05, 0.012, 0.006), 'graphite', { pos: [0, -0.05, 0.018] });
    }
    a.pop();
  }
}

function buildDomeFacade(a: Assembly) {
  const fz = R - 0.12;
  a.push({ pos: [0.1, 0.86, 0] });
  a.add(geo.box(2.62, 1.52, 0.17, 0.04), 'ceramic', { pos: [0, 0, fz] });
  a.add(geo.box(2.8, 0.13, 0.24, 0.03), 'anodized', { pos: [0, 0.75, fz + 0.02] });
  a.add(geo.box(2.8, 0.15, 0.26, 0.03), 'anodized', { pos: [0, -0.75, fz + 0.02] });
  for (const sx of [-1, 1]) a.add(geo.box(0.14, 1.66, 0.25, 0.03), 'anodized', { pos: [sx * 1.45, 0, fz + 0.02] });
  a.add(geo.box(0.07, 1.2, 0.1, 0.015), 'anodized', { pos: [0, 0, fz + 0.09] });
  a.add(geo.box(2.3, 0.07, 0.1, 0.015), 'anodized', { pos: [0, 0.12, fz + 0.09] });
  a.add(geo.plane(2.34, 1.26), 'glass', { pos: [0, 0, fz + 0.13] });
  a.add(geo.plane(2.2, 1.12), 'warm', { pos: [0, 0, fz - 0.32], rot: [0, Math.PI, 0] });
  for (const x of [-0.62, 0.02, 0.66]) a.add(geo.box(0.42, 0.52, 0.3, 0.02), 'graphite', { pos: [x, -0.28, fz - 0.36] });
  a.add(geo.box(1.7, 0.16, 0.42, 0.02), 'graphite', { pos: [0, -0.62, fz - 0.36] });
  a.add(geo.box(0.5, 0.26, 0.1, 0.015), 'cyan', { pos: [-0.8, 0.5, fz - 0.36] });
  // sill, step and handrails
  a.add(geo.box(2.94, 0.16, 0.42, 0.03), 'steel', { pos: [0, -0.86, fz + 0.1] });
  a.add(geo.box(1.44, 0.12, 0.62, 0.03), 'graphite', { pos: [0, -1.02, fz + 0.26] });
  for (const sx of [-1, 1]) {
    a.add(geo.cyl(0.03, 0.03, 0.9, 10), 'steel', { pos: [sx * 1.3, -0.5, fz + 0.5] });
    a.add(geo.cyl(0.03, 0.03, 0.9, 10), 'steel', { pos: [sx * 0.62, -0.5, fz + 0.62] });
  }
  a.add(geo.tube([[-1.3, -0.06, fz + 0.5], [-1.0, -0.04, fz + 0.56], [-0.62, -0.06, fz + 0.62]], 0.028, 14, 8), 'steel');
  a.add(geo.tube([[1.3, -0.06, fz + 0.5], [1.0, -0.04, fz + 0.56], [0.62, -0.06, fz + 0.62]], 0.028, 14, 8), 'steel');
  // facade bolt rows
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    a.add(geo.hex(0.022, 0.03), 'steel', { pos: [sx * 1.45, -0.6 + i * 0.3, fz + 0.16], quat: axisTowards(0, 0, 1) });
  }
  a.pop();
}

function buildDomeAirlock(a: Assembly) {
  const ang = 0.78;
  a.push({ pos: radial(ang, R - 0.05, 0.6), quat: turn(ang) });
  a.add(geo.ring(0.45, 0.6, 0.24, 36), 'anodized', { quat: axisTowards(0, 0, 1) });
  a.add(geo.cyl(0.47, 0.47, 0.18, 36), 'ceramic', { pos: [0, 0, -0.07], quat: axisTowards(0, 0, 1) });
  a.add(geo.cyl(0.44, 0.44, 0.15, 36), 'paint', { pos: [0, 0, 0.13], quat: axisTowards(0, 0, 1) });
  a.add(geo.ring(0.3, 0.45, 0.06, 36), 'graphite', { pos: [0, 0, 0.19], quat: axisTowards(0, 0, 1) });
  a.add(geo.ring(0.16, 0.2, 0.04, 24), 'steel', { pos: [0, 0, 0.235], quat: axisTowards(0, 0, 1) });
  a.add(geo.disc(0.29, 30), 'smoked', { pos: [0, 0, 0.222], quat: faceTowards(0, 0, 1) });
  for (let i = 0; i < 8; i++) {
    const b = (i / 8) * TAU;
    a.add(geo.hex(0.027, 0.042), 'steel', { pos: [Math.sin(b) * 0.51, Math.cos(b) * 0.51, 0.2], quat: axisTowards(0, 0, 1) });
  }
  for (const y of [0.26, -0.26]) {
    a.add(geo.box(0.15, 0.19, 0.24, 0.02), 'steel', { pos: [-0.52, y, 0.1] });
    a.add(geo.cyl(0.028, 0.028, 0.32, 10), 'steel', { pos: [-0.52, y, 0.1], quat: axisTowards(0, 0, 1) });
  }
  a.add(geo.torus(0.16, 0.025, 8, 26), 'steel', { pos: [0, 0, 0.3], quat: faceTowards(0, 0, 1) });
  for (let i = 0; i < 3; i++) a.add(geo.box(0.022, 0.32, 0.022, 0.006), 'steel', { pos: [0, 0, 0.3], rot: [0, 0, (i * Math.PI) / 3] });
  a.add(geo.cyl(0.05, 0.05, 0.1, 12), 'steel', { pos: [0, 0, 0.34], quat: axisTowards(0, 0, 1) });
  a.add(geo.plane(0.94, 0.2), 'signDark', { pos: [0, 0.82, 0.16] });
  a.add(geo.box(1.0, 0.24, 0.04, 0.012), 'graphite', { pos: [0, 0.82, 0.13] });
  a.add(geo.disc(0.05, 16), 'cyan', { pos: [0.42, 0.66, 0.2] });
  a.add(geo.box(1.3, 0.14, 0.66, 0.03), 'graphite', { pos: [0, -0.62, 0.2] });
  a.add(geo.box(1.34, 0.03, 0.7, 0.01), 'hazard', { pos: [0, -0.55, 0.2] });
  a.add(geo.box(0.14, 0.9, 0.14, 0.02), 'steel', { pos: [0.72, -0.2, 0.36] });
  a.pop();
}

function buildDomeAntenna(a: Assembly) {
  const th = 0.5, ang = 3.72;
  const n: [number, number, number] = [Math.sin(ang) * Math.cos(th), Math.sin(th), Math.cos(ang) * Math.cos(th)];
  const pad: [number, number, number] = [n[0] * (R + 0.02), BH + n[1] * (R + 0.02), n[2] * (R + 0.02)];
  a.push({ pos: pad, quat: faceTowards(n[0], n[1], n[2]) });
  a.add(geo.box(0.7, 0.7, 0.08, 0.02), 'anodized');
  a.add(geo.ring(0.24, 0.34, 0.14, 30), 'steel', { quat: axisTowards(0, 0, 1) });
  for (let i = 0; i < 6; i++) {
    const b = (i / 6) * TAU;
    a.add(geo.hex(0.026, 0.042), 'steel', { pos: [Math.sin(b) * 0.28, Math.cos(b) * 0.28, 0.07], quat: axisTowards(0, 0, 1) });
  }
  a.pop();
  a.push({ pos: pad });
  a.add(geo.cyl(0.17, 0.22, 0.2, 22), 'anodized', { pos: [0, 0.12, 0] });
  a.add(geo.cyl(0.05, 0.062, 1.75, 16), 'steel', { pos: [0, 1.05, 0] });
  a.add(geo.ring(0.062, 0.1, 0.06, 20), 'anodized', { pos: [0, 1.92, 0] });
  a.add(geo.box(0.94, 0.055, 0.055, 0.012), 'steel', { pos: [0, 1.74, 0] });
  for (const sx of [-1, 1]) {
    a.add(geo.box(0.18, 0.15, 0.22, 0.02), 'graphite', { pos: [sx * 0.42, 1.66, 0] });
    a.add(geo.disc(0.055, 16), 'cyan', { pos: [sx * 0.42, 1.66, 0.12] });
    a.add(geo.box(0.09, 0.05, 0.05, 0.01), 'steel', { pos: [sx * 0.24, 1.74, 0] });
  }
  a.add(geo.cyl(0.075, 0.095, 0.16, 16), 'steel', { pos: [0.3, 1.32, 0], quat: axisTowards(1, 0, 0) });
  a.push({ pos: [0.36, 1.32, 0], quat: faceTowards(0.3, 0.88, 0.36) });
  a.add(geo.lathe([[0.02, 0], [0.1, 0.014], [0.19, 0.05], [0.27, 0.105], [0.31, 0.145]], 40), 'paint', { quat: axisTowards(0, 0, 1) });
  a.add(geo.ring(0.305, 0.33, 0.02, 40), 'steel', { pos: [0, 0, 0.13], quat: axisTowards(0, 0, 1) });
  a.add(geo.cyl(0.018, 0.026, 0.28, 12), 'steel', { pos: [0, 0, 0.26], quat: axisTowards(0, 0, 1) });
  a.add(geo.cyl(0.055, 0.042, 0.08, 14), 'graphite', { pos: [0, 0, 0.38], quat: axisTowards(0, 0, 1) });
  for (let i = 0; i < 3; i++) {
    const b = (i / 3) * TAU;
    a.add(geo.tube([[Math.sin(b) * 0.28, Math.cos(b) * 0.28, 0.14], [0, 0, 0.36]], 0.011, 4, 6), 'steel');
  }
  a.pop();
  a.add(geo.cyl(0.011, 0.013, 0.85, 10), 'steel', { pos: [0, 2.35, 0] });
  a.add(geo.box(0.06, 0.06, 0.06, 0.01), 'anodized', { pos: [0, 2.72, 0] });
  a.pop();
}

function buildDomeBeacons(a: Assembly) {
  const spots: Array<[number, number]> = [[1.15, 0.72], [2.55, 0.66], [4.35, 0.75], [5.6, 0.6]];
  spots.forEach(([ang, th]) => {
    const n: [number, number, number] = [Math.sin(ang) * Math.cos(th), Math.sin(th), Math.cos(ang) * Math.cos(th)];
    const pos: [number, number, number] = [n[0] * (R + 0.05), BH + n[1] * (R + 0.05), n[2] * (R + 0.05)];
    a.push({ pos, quat: faceTowards(n[0], n[1], n[2]) });
    a.add(geo.cyl(0.15, 0.17, 0.14, 20), 'anodized');
    a.add(geo.ring(0.16, 0.2, 0.05, 20), 'steel', { pos: [0, 0, 0.08], quat: axisTowards(0, 0, 1) });
    a.add(geo.sphere(0.095, 22, 14), 'red', { pos: [0, 0, 0.16] });
    a.pop();
  });
  // airlock and facade indicators
  for (const [x, y, z] of [[1.35, 1.3, R + 0.2], [-1.2, 0.2, R + 0.2]] as Array<[number, number, number]>) {
    a.add(geo.box(0.34, 0.05, 0.03, 0.008), 'cyan', { pos: [x, y, z] });
  }
  a.add(geo.disc(0.34, 24), 'warm', { pos: [0.1, BH + 0.02, R + 0.55], rot: [Math.PI / 2, 0, 0] });
}

const domeModules: ModuleSpec[] = [
  { id: 'dome-base', name: '穹顶环形基座', note: '20 向加强肋 + 8 舷窗 + 设备箱 + 线管', channel: '壳体', offset: [0, -0.6, 0], shadow: 'cast', build: buildDomeBase },
  { id: 'dome-shell', name: '穹顶壳体', note: '陶瓷复材半球 + 4 道纬肋 / 8 道经肋 + 顶部设备层', channel: '壳体', offset: [0, 2.2, 0], shadow: 'cast', build: buildDomeShell },
  { id: 'dome-facade', name: '观测窗组', note: '夹层玻璃幕 + 竖挺横档 + 内部暖光轮廓', channel: '围护', offset: [0.1, 0.5, 2.0], shadow: 'cast', build: buildDomeFacade },
  { id: 'dome-airlock', name: '气密门总成', note: '门框 / 门体 / 手轮 / 铰链 / 踏步', channel: '围护', offset: [1.5, 0.25, 1.6], shadow: 'cast', build: buildDomeAirlock },
  { id: 'dome-antenna', name: '通信天线组', note: '俯仰座 + 桅杆 + 抛物面 + 三脚馈源', channel: '仪器', offset: [0.9, 2.9, -0.6], shadow: 'receive', build: buildDomeAntenna },
  { id: 'dome-beacons', name: '航障与指示灯', note: '壳体航障灯 + 门侧状态灯 + 檐下工作灯', channel: '仪表', offset: [0, 3.4, 0.4], shadow: 'receive', build: buildDomeBeacons },
];

// ------------------------------------------------------------------ lamps

function lampModule(spec: LampSpec, index: number): ModuleSpec {
  const [ox, oz] = spec.origin;
  const az = Math.atan2(-ox, -oz); // face the deck centre
  const outward = Math.hypot(ox, oz) || 1;
  return {
    id: spec.id,
    name: spec.name,
    note: '投光灯柱 · 可变向灯头 / 拉索 / 接线箱',
    channel: '照明',
    offset: [(ox / outward) * 1.5, 0.55, (oz / outward) * 1.5],
    shadow: 'cast',
    build: (a, ctx) => {
      const rt = ctx.lamps[index];
      a.push({ pos: [ox, 0, oz] });
      a.add(geo.box(0.36, 0.09, 0.36, 0.02), 'steel', { pos: [0, 0.045, 0] });
      a.add(geo.box(0.28, 0.03, 0.28, 0.01), 'graphite', { pos: [0, 0.1, 0] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(geo.hex(0.03, 0.05), 'steel', { pos: [sx * 0.13, 0.03, sz * 0.13] });
      a.add(geo.cyl(0.085, 0.115, 0.2, 20), 'anodized', { pos: [0, 0.2, 0] });
      a.add(geo.cyl(0.05, 0.068, LAMP_POLE_H - 0.3, 20), 'steel', { pos: [0, 0.3 + (LAMP_POLE_H - 0.3) / 2, 0] });
      a.add(geo.ring(0.06, 0.095, 0.08, 20), 'anodized', { pos: [0, LAMP_POLE_H - 0.35, 0] });
      // junction box, conduit and clamps
      a.add(geo.box(0.17, 0.26, 0.15, 0.02), 'anodized', { pos: [0.12, 1.1, 0] });
      a.add(geo.cyl(0.028, 0.028, LAMP_POLE_H - 0.55, 10), 'rubber', { pos: [0.085, (LAMP_POLE_H - 0.5) / 2 + 0.1, 0] });
      for (const y of [0.6, 1.4, 2.1]) a.add(geo.box(0.09, 0.07, 0.09, 0.015), 'steel', { pos: [0.075, y, 0] });
      // guy rods
      a.add(geo.tube([[0.28, 0.06, 0.1], [0.05, 1.55, 0.03]], 0.016, 4, 6), 'steel');
      a.add(geo.tube([[0.28, 0.06, -0.1], [0.05, 1.55, -0.03]], 0.016, 4, 6), 'steel');
      a.add(geo.box(0.1, 0.1, 0.2, 0.015), 'steel', { pos: [0.28, 0.09, 0] });
      // head (authored facing +Z, then aimed)
      a.push({ pos: [0, LAMP_POLE_H, 0], quat: turn(az) });
      a.add(geo.box(0.2, 0.18, 0.14, 0.02), 'anodized', { pos: [0, 0.08, -0.02] });
      for (const sx of [-1, 1]) {
        a.add(geo.box(0.05, 0.26, 0.13, 0.015), 'steel', { pos: [sx * 0.17, 0.2, 0] });
        a.add(geo.cyl(0.022, 0.022, 0.1, 10), 'steel', { pos: [sx * 0.2, 0.2, 0], quat: axisTowards(sx, 0, 0) });
      }
      a.push({ rot: [0.44, 0, 0] });
      a.add(geo.box(0.46, 0.26, 0.32, 0.03), 'graphite', { pos: [0, 0.2, 0.05] });
      for (let i = 0; i < 6; i++) a.add(geo.box(0.02, 0.2, 0.18, 0.006), 'alu', { pos: [-0.24, 0.2, -0.05 + i * 0.026] });
      for (const sx of [-1, 1]) a.add(geo.box(0.03, 0.16, 0.32, 0.01), 'anodized', { pos: [sx * 0.235, 0.2, 0.05] });
      a.add(geo.box(0.52, 0.045, 0.34, 0.015), 'anodized', { pos: [0, 0.36, 0.08] });
      a.add(geo.cyl(0.135, 0.135, 0.09, 24), 'anodized', { pos: [0, 0.2, 0.23], quat: axisTowards(0, 0, 1) });
      a.add(geo.ring(0.135, 0.16, 0.04, 24), 'steel', { pos: [0, 0.2, 0.27], quat: axisTowards(0, 0, 1) });
      a.add(geo.disc(0.108, 24), rt.lens, { pos: [0, 0.2, 0.285], quat: faceTowards(0, 0, 1) });
      a.add(geo.cyl(0.032, 0.038, 0.09, 12), 'rubber', { pos: [0, 0.36, -0.1] });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(geo.hex(0.018, 0.026), 'steel', { pos: [sx * 0.2, 0.33, sz * 0.06 + 0.02] });
      a.pop();
      a.pop();
      a.pop();
    },
  };
}

const lampModules: ModuleSpec[] = LAMPS.map(lampModule);

// ------------------------------------------------------------------- site

function buildSiteMarkings(a: Assembly) {
  // painted approach line curving across the deck
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.6, 0, 3.6), new THREE.Vector3(1.9, 0, 2.5), new THREE.Vector3(3.1, 0, 1.2), new THREE.Vector3(3.6, 0, -0.9),
  ]);
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    a.add(geo.plane(0.34, 0.72), 'orange', { pos: [p.x, -0.036, p.z], rot: [-Math.PI / 2, Math.atan2(tan.x, tan.z), 0] });
  }
  // hazard-painted service zone in front of the dome
  a.add(geo.plane(2.6, 1.1), 'hazard', { pos: [-1.9, -0.036, 1.5], rot: [-Math.PI / 2, 0, 0] });
  a.add(geo.plane(1.5, 0.55), 'hazard', { pos: [3.9, -0.036, -0.4], rot: [-Math.PI / 2, 0.45, 0] });
  // walkway strips along the foot of the dome
  a.add(geo.plane(3.4, 0.24), 'paint', { pos: [-1.6, -0.037, 2.05], rot: [-Math.PI / 2, 0, 0] });
}

function buildSiteServices(a: Assembly) {
  // barrier row of concrete blocks with hazard tops
  for (let i = 0; i < 5; i++) {
    const x = -4.3 + i * 0.72, z = 1.35 + (i % 2) * 0.16;
    a.push({ pos: [x, 0, z], rot: [0, 0.12 * (i % 3 - 1), 0] });
    a.add(geo.box(0.66, 0.3, 0.28, 0.02), 'paint', { pos: [0, 0.15, 0] });
    a.add(geo.box(0.7, 0.06, 0.32, 0.015), 'hazard', { pos: [0, 0.32, 0] });
    a.add(geo.box(0.56, 0.04, 0.2, 0.01), 'graphite', { pos: [0, 0.02, 0] });
    a.pop();
  }
  // bollards
  for (const [x, z] of [[-2.4, 3.0], [-1.1, 3.05], [0.2, 2.95], [1.5, 2.85]] as Array<[number, number]>) {
    a.push({ pos: [x, 0, z] });
    a.add(geo.cyl(0.06, 0.075, 0.62, 14), 'steel', { pos: [0, 0.31, 0] });
    a.add(geo.sphere(0.07, 16, 10), 'graphite', { pos: [0, 0.64, 0] });
    a.add(geo.ring(0.062, 0.075, 0.06, 16), 'orange', { pos: [0, 0.5, 0] });
    a.add(geo.ring(0.062, 0.075, 0.06, 16), 'orange', { pos: [0, 0.34, 0] });
    a.add(geo.box(0.24, 0.04, 0.24, 0.012), 'graphite', { pos: [0, 0.02, 0] });
    a.pop();
  }
  // cable reels and a tool crate
  a.push({ pos: [4.4, 0, 2.5], rot: [0, 0.5, 0] });
  a.add(geo.cyl(0.32, 0.32, 0.3, 26), 'graphite', { pos: [0, 0.33, 0], quat: axisTowards(1, 0, 0) });
  for (const sx of [-1, 1]) a.add(geo.cyl(0.42, 0.42, 0.05, 26), 'steel', { pos: [sx * 0.16, 0.33, 0], quat: axisTowards(1, 0, 0) });
  a.add(geo.cyl(0.05, 0.05, 0.5, 12), 'steel', { pos: [0, 0.33, 0], quat: axisTowards(1, 0, 0) });
  for (const sx of [-1, 1]) a.add(geo.box(0.12, 0.3, 0.3, 0.02), 'steel', { pos: [sx * 0.28, 0.15, 0] });
  a.add(geo.tube([[0.2, 0.32, 0.4], [0.7, 0.3, 0.6], [1.2, 0.32, 0.5]], 0.045, 20, 6), 'rubber');
  a.pop();
  a.push({ pos: [3.0, 0, 3.1], rot: [0, -0.35, 0] });
  a.add(geo.box(0.86, 0.46, 0.6, 0.02), 'graphite', { pos: [0, 0.23, 0] });
  a.add(geo.box(0.9, 0.07, 0.64, 0.02), 'anodized', { pos: [0, 0.48, 0] });
  a.add(geo.box(0.78, 0.03, 0.5, 0.01), 'orange', { pos: [0, 0.52, 0] });
  for (const sx of [-1, 1]) a.add(geo.box(0.1, 0.08, 0.06, 0.012), 'steel', { pos: [sx * 0.3, 0.44, 0.32] });
  a.add(geo.torus(0.1, 0.018, 6, 16), 'steel', { pos: [0, 0.52, -0.22], rot: [Math.PI / 2, 0, 0] });
  a.pop();
  // pipe runs crossing the deck to the cable tray
  a.add(geo.tube([[-5.4, 0.1, -1.9], [-3.2, 0.12, -2.4], [-0.6, 0.1, -2.7], [2.2, 0.12, -3.0], [5.4, 0.1, -3.2]], 0.075, 48, 10), 'steel');
  a.add(geo.tube([[-5.4, 0.1, -2.2], [-3.2, 0.1, -2.7], [-0.6, 0.1, -3.0], [2.2, 0.1, -3.3], [5.4, 0.1, -3.5]], 0.05, 48, 8), 'steel');
  for (const x of [-3.6, 0, 3.6]) {
    a.add(geo.box(0.2, 0.16, 0.5, 0.02), 'anodized', { pos: [x, 0.08, -2.85] });
    a.add(geo.cyl(0.06, 0.06, 0.16, 12), 'rubber', { pos: [x, 0.16, -2.85], rot: [Math.PI / 2, 0, 0] });
  }
}

const siteModules: ModuleSpec[] = [
  { id: 'site-markings', name: '场地标线', note: '引导线 / 危险区域 / 通道涂料', channel: '场地', offset: [-1.3, 0.5, -1.3], shadow: 'receive', build: buildSiteMarkings },
  { id: 'site-services', name: '场地设施', note: '隔离墩 / 立柱 / 线缆盘 / 工具箱 / 管线', channel: '场地', offset: [-1.7, 0.45, 1.8], shadow: 'cast', build: buildSiteServices },
];

// ---------------------------------------------------------------- vehicle

// The parked support car is split into two modules so the explode view pulls the
// wheels off the hubs instead of moving one solid block.
const vehicleModules: ModuleSpec[] = [
  { id: 'vehicle-body', name: '整车车体', note: '993 宽体 · 熔岩橙车漆 · 双片尾翼 / 前铲', channel: '载荷', offset: [0.9, 1.05, 0], shadow: 'cast', build: buildCarBody },
  { id: 'vehicle-wheels', name: '车轮总成', note: '镁合金中锁轮毂 · 半热熔轮胎 · 卡钳', channel: '行走', offset: [1.9, -0.5, 0], shadow: 'cast', build: buildCarWheels },
];

// ------------------------------------------------------------------ export

export function sections(): SectionSpec[] {
  return [
    { id: 'platform', label: 'A · 平台结构', modules: platformModules },
    { id: 'dome', label: 'B · 主穹顶', modules: domeModules.map((m) => ({ ...m, build: (a: Assembly, ctx: BuildContext) => { a.push({ pos: [DOME.x, 0, DOME.z] }); m.build(a, ctx); a.pop(); } })) },
    { id: 'lamps', label: 'C · 作业照明', modules: lampModules },
    { id: 'site', label: 'D · 场地设施', modules: siteModules },
    { id: 'vehicle', label: 'E · 车辆', modules: vehicleModules },
  ];
}

export const LABELS: LabelSpec[] = [
  { id: 'dome-shell', title: '穹顶壳体', sub: '陶瓷复材 · 经纬加强肋', anchor: [DOME.x, 2.85, DOME.z + 0.2] },
  { id: 'dome-facade', title: '观测窗组', sub: '夹层玻璃 · 暖光内舱', anchor: [DOME.x + 0.1, 1.75, DOME.z + 2.35] },
  { id: 'dome-antenna', title: '通信天线组', sub: '俯仰座 · 抛物面馈源', anchor: [DOME.x - 1.2, 4.5, DOME.z - 1.9] },
  { id: 'dome-airlock', title: '气密门总成', sub: '手轮锁紧 · 双铰链', anchor: [DOME.x + 1.55, 1.35, DOME.z + 1.75] },
  { id: 'platform-signage', title: '铭牌 SITE 07', sub: 'SELENE 月面基地', anchor: [-2.3, 0.2, D + 0.35] },
  { id: 'lamp-1', title: '作业照明', sub: '可变向投光灯柱', anchor: [-4.95, 3.25, -3.2] },
  { id: 'site-services', title: '场地设施', sub: '隔离与补给器材', anchor: [3.6, 0.75, 2.6] },
  { id: 'vehicle-body', title: '车辆总成', sub: '宽体 993 · 镁合金中锁轮毂', anchor: [CAR.x - 0.15, 2.4, CAR.z] },
];
