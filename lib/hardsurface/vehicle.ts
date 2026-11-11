// Parked 993-generation 911 widebody — the support vehicle on the SITE 07 deck.
// Authored with the same Assembly toolbox as the rest of the diorama, so it merges by
// material, carries a hover outline / pick proxy, and joins the explode view like any
// other module. Style comes from the shared palette, silhouette from the body loft.
import { loft } from '../car-geometry';
import { Assembly, axisTowards, faceTowards, geo, turn } from './kit';

const TAU = Math.PI * 2;

// Field-frame parking pose: on the deck, right of the dome, nose angled toward the
// observation facade. y drops the tyre contact patch onto the deck plates.
export const CAR = { x: 2.85, z: -0.25, y: -0.03, rot: -0.2 };
const WHEEL_Z = [1.36, -1.35];
const TRACK = 0.94;
const WHEEL_Y = 0.44;

// [z, halfWidth, top, bottom] — elliptical cross-sections. The blisters at the axles
// (z = ±1.35) are what make this a widebody rather than the plain coupe profile.
const BODY: Array<[number, number, number, number]> = [
  [-2.28, .50, .74, .46],
  [-2.12, .84, .84, .34],
  [-1.88, 1.02, .88, .28],
  [-1.52, 1.07, .92, .25],
  [-1.08, 1.02, .94, .25],
  [-.52, .96, .92, .24],
  [.42, .93, .84, .24],
  [1.06, 1.00, .80, .26],
  [1.36, 1.05, .79, .27],
  [1.66, .98, .75, .29],
  [1.98, .85, .68, .32],
  [2.14, .66, .61, .36],
  [2.30, .30, .51, .42],
];
const CABIN: Array<[number, number, number, number]> = [
  [-1.42, .57, .90, .80],
  [-1.08, .70, 1.17, .81],
  [-.68, .72, 1.41, .82],
  [-.18, .70, 1.46, .82],
  [.30, .66, 1.38, .80],
  [.68, .58, 1.13, .78],
  [1.06, .42, .79, .72],
];
const ROOF: Array<[number, number, number, number]> = [
  [-.80, .48, 1.40, 1.35],
  [-.58, .53, 1.47, 1.42],
  [-.16, .52, 1.51, 1.46],
  [.26, .48, 1.43, 1.38],
];

// Half-width of the lofted shell at a station, so trim can hug the surface instead of
// floating off it (the profile is an ellipse per section, interpolated along z).
function shellX(z: number, y: number) {
  const stations = BODY;
  const clamped = Math.min(Math.max(z, stations[0][0]), stations[stations.length - 1][0]);
  let i = 0;
  while (i < stations.length - 2 && stations[i + 1][0] < clamped) i += 1;
  const [z0, w0, t0, b0] = stations[i];
  const [z1, w1, t1, b1] = stations[i + 1];
  const t = z1 === z0 ? 0 : (clamped - z0) / (z1 - z0);
  const w = w0 + (w1 - w0) * t;
  const top = t0 + (t1 - t0) * t;
  const bottom = b0 + (b1 - b0) * t;
  const centre = (top + bottom) / 2;
  const half = (top - bottom) / 2;
  const cos = half === 0 ? 0 : (y - centre) / half;
  return w * Math.sqrt(Math.max(0, 1 - cos * cos));
}

function surfaceLine(fixed: 'z' | 'y', value: number, from: number, to: number, steps: number) {
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const x = fixed === 'z' ? shellX(value, t) : shellX(t, value);
    points.push(fixed === 'z' ? [x + 0.004, t, value] : [x + 0.004, value, t]);
  }
  return points;
}

// Cabin fittings stay coarse — they are only ever seen through tinted glass.
function interior(a: Assembly) {
  a.add(geo.box(1.42, 0.05, 2, 0.02), 'graphite', { pos: [0, 0.4, -0.14] });
  a.add(geo.box(1.3, 0.22, 0.3, 0.03), 'graphite', { pos: [0, 0.84, 0.6] });
  for (let i = -1; i <= 1; i++) {
    a.add(geo.disc(0.038, 16), 'cyan', { pos: [i * 0.11 - 0.36, 0.86, 0.76], quat: faceTowards(0, -0.3, 1) });
  }
  // alcantara wheel with the orange centre marker, plus the carbon-topped console
  a.add(geo.torus(0.155, 0.022, 8, 28), 'rubber', { pos: [-0.36, 0.92, 0.5], rot: [-0.35, 0, 0] });
  a.add(geo.box(0.05, 0.05, 0.02, 0.006), 'orange', { pos: [-0.36, 1.06, 0.44], rot: [-0.35, 0, 0] });
  a.add(geo.cyl(0.03, 0.03, 0.24, 10), 'graphite', { pos: [-0.36, 0.88, 0.63], rot: [0.42, 0, 0] });
  a.add(geo.box(0.2, 0.14, 0.6, 0.02), 'graphite', { pos: [0, 0.68, 0.45] });
  for (const sign of [-1, 1]) {
    a.add(geo.box(0.44, 0.1, 0.48, 0.03), 'orange', { pos: [sign * 0.36, 0.64, -0.02], rot: [-0.1, 0, 0] });
    a.add(geo.box(0.42, 0.5, 0.13, 0.03), 'orange', { pos: [sign * 0.36, 0.9, -0.32], rot: [-0.18, 0, 0] });
    a.add(geo.box(0.26, 0.16, 0.11, 0.03), 'orange', { pos: [sign * 0.36, 1.16, -0.36], rot: [-0.18, 0, 0] });
    a.add(geo.box(0.06, 0.34, 0.02, 0.008), 'graphite', { pos: [sign * 0.36, 0.9, -0.25], rot: [-0.18, 0, 0] });
  }
  // bolt-in hoop, as in the interior reference sheet
  a.add(geo.tube([[-0.6, 0.5, -0.9], [-0.38, 0.94, -0.96], [0.38, 0.94, -0.96], [0.6, 0.5, -0.9]], 0.03, 20, 6), 'anodized');
  a.add(geo.tube([[-0.38, 0.94, -0.96], [0.3, 0.56, -1.28]], 0.02, 10, 6), 'anodized');
}

function rearWing(a: Assembly) {
  for (const sign of [-1, 1]) {
    a.add(geo.box(0.07, 0.38, 0.26, 0.02), 'anodized', { pos: [sign * 0.44, 0.97, -2.02], rot: [0.16, 0, 0] });
    a.add(geo.hex(0.05, 0.045), 'steel', { pos: [sign * 0.44, 1.15, -2.07], quat: axisTowards(0, 0, 1) });
  }
  a.add(geo.box(1.42, 0.045, 0.4, 0.015), 'graphite', { pos: [0, 1.17, -2.04], rot: [-0.1, 0, 0] });
  a.add(geo.box(1.5, 0.045, 0.36, 0.015), 'graphite', { pos: [0, 1.4, -2.1], rot: [-0.18, 0, 0] });
  a.add(geo.box(1.5, 0.022, 0.05, 0.008), 'orange', { pos: [0, 1.43, -2.25], rot: [-0.18, 0, 0] });
  for (const sign of [-1, 1]) a.add(geo.box(0.035, 0.3, 0.44, 0.012), 'graphite', { pos: [sign * 0.76, 1.28, -2.06], rot: [-0.12, 0, 0] });
}

function lampsAndTrim(a: Assembly) {
  for (const sign of [-1, 1]) {
    // upright round lamp in a graphite housing
    a.push({ pos: [sign * 0.6, 0.72, 1.82], quat: axisTowards(0, 0.22, 0.97) });
    a.add(geo.cyl(0.195, 0.175, 0.11, 32), 'graphite', { pos: [0, -0.02, 0] });
    a.add(geo.ring(0.155, 0.2, 0.05, 32), 'steel', { pos: [0, 0.04, 0] });
    a.add(geo.disc(0.165, 32), 'warm', { pos: [0, 0.055, 0], quat: faceTowards(0, 1, 0) });
    a.add(geo.disc(0.075, 20), 'graphite', { pos: [0, 0.062, 0], quat: faceTowards(0, 1, 0) });
    a.pop();
    // mirror on a stub arm
    a.add(geo.sphere(1, 16, 12), 'carPaint', { pos: [sign * 0.97, 0.95, 0.6], scale: [0.17, 0.075, 0.11] });
    a.add(geo.cyl(0.022, 0.022, 0.18, 8), 'graphite', { pos: [sign * 0.87, 0.92, 0.63], quat: axisTowards(sign, 0.2, 0) });
    // door handle + fuel flap
    a.add(geo.box(0.13, 0.035, 0.05, 0.012), 'steel', { pos: [sign * (shellX(0.2, 0.72) + 0.012), 0.72, 0.2] });
    if (sign > 0) {
      a.add(geo.ring(0.05, 0.075, 0.025, 20), 'steel', { pos: [shellX(0.95, 0.68) + 0.012, 0.68, 0.95], quat: axisTowards(1, 0, 0) });
    }
    // waistline moulding + door shut line, both following the shell
    a.add(geo.tube(surfaceLine('y', 0.58, -1.95, 2.0, 12).map(([x, y, z]) => [sign * x, y, z] as [number, number, number]), 0.02, 26, 6), 'anodized');
    a.add(geo.tube(surfaceLine('z', 0.42, 0.42, 0.9, 6).map(([x, y, z]) => [sign * x, y, z] as [number, number, number]), 0.011, 8, 5), 'graphite');
    a.add(geo.tube(surfaceLine('z', -0.78, 0.42, 0.9, 6).map(([x, y, z]) => [sign * x, y, z] as [number, number, number]), 0.011, 8, 5), 'graphite');
    // quarter-panel cooling intake
    a.push({ pos: [sign * (shellX(-0.9, 0.66) + 0.01), 0.66, -0.9], quat: turn(sign * Math.PI / 2) });
    a.vent(0.44, 0.2, 4, 'anodized', 'graphite');
    a.pop();
    // rocker skirt blade
    a.add(geo.box(0.05, 0.1, 2.3, 0.01), 'graphite', { pos: [sign * 1.0, 0.28, 0] });
  }
  // full-width tail band, rear plate and reflectors
  a.add(geo.box(1.5, 0.1, 0.05, 0.012), 'red', { pos: [0, 0.8, -2.3] });
  a.add(geo.box(0.5, 0.13, 0.03, 0.01), 'steel', { pos: [0, 0.54, -2.31] });
  a.add(geo.box(0.42, 0.08, 0.015, 0.006), 'graphite', { pos: [0, 0.54, -2.33] });
  a.add(geo.disc(0.045, 16), 'magnesium', { pos: [0, 0.757, 1.5], quat: faceTowards(0, 1, 0) });
  a.add(geo.box(1.05, 0.09, 0.06, 0.015), 'graphite', { pos: [0, 0.44, 2.2] });
  a.add(geo.cyl(0.09, 0.09, 0.05, 20), 'graphite', { pos: [-0.95, 0.62, 1.5], quat: axisTowards(1, 0, 0) });
}

// ---------------------------------------------------------------- exports

export function buildCarBody(a: Assembly) {
  a.push({ pos: [CAR.x, CAR.y, CAR.z], quat: turn(CAR.rot) });
  a.add(loft(BODY, 40), 'carPaint');
  a.add(loft(CABIN, 40), 'glass');
  a.add(loft(ROOF, 32), 'carPaint');
  a.add(geo.box(1.52, 0.16, 3.7, 0.02), 'graphite', { pos: [0, 0.3, 0] });
  for (const sign of [-1, 1]) for (const z of WHEEL_Z) {
    a.add(geo.cyl(0.4, 0.4, 0.42, 24), 'graphite', { pos: [sign * 0.82, WHEEL_Y + 0.04, z], quat: axisTowards(sign, 0, 0) });
  }
  a.add(geo.box(1.74, 0.05, 0.46, 0.015), 'graphite', { pos: [0, 0.2, 2.06] });
  for (const sign of [-1, 1]) a.add(geo.box(0.4, 0.03, 0.3, 0.01), 'graphite', { pos: [sign * 0.84, 0.36, 1.9], rot: [0, sign * -0.4, 0] });
  a.add(geo.box(1.5, 0.16, 0.34, 0.02), 'graphite', { pos: [0, 0.28, -2.16] });
  for (let i = 0; i < 7; i++) a.add(geo.box(0.03, 0.17, 0.3, 0.008), 'anodized', { pos: [-0.6 + i * 0.2, 0.28, -2.18] });
  for (const sign of [-1, 1]) {
    a.add(geo.cyl(0.072, 0.072, 0.18, 16), 'steel', { pos: [sign * 0.56, 0.36, -2.2], quat: axisTowards(0, 0, 1) });
    a.add(geo.ring(0.072, 0.095, 0.03, 16), 'steel', { pos: [sign * 0.56, 0.36, -2.3], quat: axisTowards(0, 0, 1) });
  }
  interior(a);
  rearWing(a);
  lampsAndTrim(a);
  a.pop();
}

export function buildCarWheels(a: Assembly) {
  a.push({ pos: [CAR.x, CAR.y, CAR.z], quat: turn(CAR.rot) });
  for (const sign of [-1, 1]) for (const z of WHEEL_Z) {
    a.push({ pos: [sign * TRACK, WHEEL_Y, z] });
    a.add(geo.torus(0.3, 0.105, 18, 48), 'rubber', { quat: turn(Math.PI / 2) });
    a.add(geo.cyl(0.262, 0.262, 0.08, 40), 'magnesium', { pos: [sign * 0.085, 0, 0], quat: axisTowards(sign, 0, 0) });
    a.add(geo.cyl(0.215, 0.215, 0.06, 32), 'steel', { pos: [sign * 0.065, 0, 0], quat: axisTowards(sign, 0, 0) });
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * TAU;
      a.add(geo.box(0.04, 0.036, 0.215, 0.008), 'magnesium', { pos: [sign * 0.115, Math.sin(angle) * 0.115, Math.cos(angle) * 0.115], rot: [-angle, 0, 0] });
    }
    a.add(geo.cyl(0.078, 0.078, 0.09, 20), 'magnesium', { pos: [sign * 0.125, 0, 0], quat: axisTowards(sign, 0, 0) });
    a.add(geo.hex(0.056, 0.06), 'steel', { pos: [sign * 0.145, 0, 0], quat: axisTowards(sign, 0, 0) });
    a.add(geo.box(0.05, 0.22, 0.09, 0.03), 'orange', { pos: [sign * 0.055, 0.14, -0.16] });
    a.pop();
  }
  a.pop();
}
