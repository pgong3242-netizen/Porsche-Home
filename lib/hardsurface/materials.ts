// PBR material palette for the industrial hard-surface diorama.
// One instance per key so meshes share programs and stay batchable.
import * as THREE from 'three';
import type { TextureSet } from './textures';

export type MaterialKey =
  | 'ceramic' | 'paint' | 'carPaint' | 'anodized' | 'graphite' | 'steel' | 'alu' | 'titanium' | 'magnesium'
  | 'orange' | 'yellow' | 'rubber' | 'glass' | 'smoked' | 'hazard'
  | 'warm' | 'cyan' | 'red' | 'amber' | 'signLight' | 'signDark'
  | 'rock' | 'dust' | 'aoBlob' | 'pool' | 'beam';

export const MATERIAL_KEYS: MaterialKey[] = [
  'ceramic', 'paint', 'carPaint', 'anodized', 'graphite', 'steel', 'alu', 'titanium', 'magnesium',
  'orange', 'yellow', 'rubber', 'glass', 'smoked', 'hazard',
  'warm', 'cyan', 'red', 'amber', 'signLight', 'signDark',
  'rock', 'dust', 'aoBlob', 'pool', 'beam',
];

export type Materials = Record<MaterialKey, THREE.Material>;

const METAL = { envMapIntensity: 0.55 } as const;

export function createMaterials(tex: TextureSet): Materials {
  const standard = (color: string, roughness: number, metalness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...METAL, ...extra });

  return {
    // primary shells — ceramic white with a thin clear coat
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#e7e9e6', roughness: 0.34, metalness: 0.06, clearcoat: 0.28, clearcoatRoughness: 0.42, envMapIntensity: 0.6, roughnessMap: tex.brush }),
    paint: standard('#d9dcdd', 0.42, 0.05, { roughnessMap: tex.brush }),
    // the parked car's lacquer — glossy orange, deliberately matching the hazard accent
    carPaint: new THREE.MeshPhysicalMaterial({ color: '#c8571c', roughness: 0.26, metalness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.88 }),
    // structural blacks
    anodized: standard('#1c2026', 0.36, 0.9, { roughnessMap: tex.brush }),
    graphite: standard('#2d3238', 0.6, 0.34, { roughnessMap: tex.brush }),
    steel: standard('#6f767c', 0.3, 0.92),
    alu: standard('#b4babf', 0.28, 0.88, { roughnessMap: tex.brush }),
    titanium: standard('#8a9197', 0.5, 0.7, { roughnessMap: tex.brush }),
    magnesium: standard('#b18a4c', 0.3, 0.9),
    // accents
    orange: standard('#cf6720', 0.5, 0.14),
    yellow: standard('#cba827', 0.46, 0.2),
    rubber: standard('#12141a', 0.86, 0.02),
    glass: new THREE.MeshPhysicalMaterial({ color: '#0e1519', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.42, clearcoat: 1, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    smoked: new THREE.MeshPhysicalMaterial({ color: '#080c10', roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.58, envMapIntensity: 0.9, side: THREE.DoubleSide }),
    hazard: standard('#c9a323', 0.55, 0.14, { map: tex.hazard }),
    // illuminated elements — these are what the bloom pass is allowed to pick up
    warm: standard('#fff2d8', 0.4, 0, { emissive: new THREE.Color('#ffd79c'), emissiveIntensity: 3.1 }),
    amber: standard('#ffcf8a', 0.4, 0, { emissive: new THREE.Color('#ff9b3c'), emissiveIntensity: 3.4 }),
    cyan: standard('#0a2c34', 0.35, 0, { emissive: new THREE.Color('#3ce0f5'), emissiveIntensity: 3.6 }),
    red: standard('#2b0507', 0.4, 0, { emissive: new THREE.Color('#ff3418'), emissiveIntensity: 4 }),
    signLight: standard('#f0f2f4', 0.5, 0, { map: tex.text('SELENE // SITE 07', { px: 72, color: '#f4f6f8' }), transparent: true, roughness: 0.5 }),
    signDark: standard('#1b1f24', 0.5, 0, { map: tex.text('DEVELOPMENT CENTER', { px: 60, color: '#f2f4f6' }), transparent: true, roughness: 0.5 }),
    // ground / environment
    rock: new THREE.MeshStandardMaterial({ color: '#8f9296', roughness: 0.95, metalness: 0.02, flatShading: true, envMapIntensity: 0.4 }),
    dust: new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.98, metalness: 0.02 }),
    aoBlob: new THREE.MeshBasicMaterial({ map: tex.ao, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ map: tex.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, color: new THREE.Color('#ffd9a4'), toneMapped: false }),
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6a0'), transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
  };
}

export function disposeMaterials(materials: Materials) {
  for (const key of MATERIAL_KEYS) materials[key].dispose();
}

// Per-lamp beam / floor pool so a single fixture can be switched on and off.
export function createLampMaterials(tex: TextureSet) {
  return {
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6a0'), transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ map: tex.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, color: new THREE.Color('#ffd9a4'), toneMapped: false }),
    lens: new THREE.MeshStandardMaterial({ color: '#fff1d6', roughness: 0.35, metalness: 0, emissive: new THREE.Color('#ffd79c'), emissiveIntensity: 3.2 }),
  };
}

export type LampMaterials = ReturnType<typeof createLampMaterials>;

// Inverted-hull rim outline: expands along normals in view space, drawn on back faces.
export function createOutlineMaterial(color: string, thickness = 0.014) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uThickness: { value: thickness } },
    vertexShader: [
      'uniform float uThickness;',
      'void main() {',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vec3 n = normalize(normalMatrix * normal);',
      '  mv.xyz += n * uThickness * (1.0 + 0.1 * -mv.z);',
      '  gl_Position = projectionMatrix * mv;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uColor;',
      'void main() { gl_FragColor = vec4(uColor, 1.0); }',
    ].join('\n'),
    side: THREE.BackSide,
    toneMapped: false,
  });
}
