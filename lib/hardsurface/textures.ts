// Procedural canvas textures for the hard-surface diorama.
// Everything is generated at runtime — the scene ships zero image assets.
import * as THREE from 'three';

export type TextOptions = { px?: number; weight?: number; color?: string; tracking?: number };

export type TextureSet = {
  hazard: THREE.Texture;
  glow: THREE.Texture;
  ao: THREE.Texture;
  brush: THREE.Texture;
  text: (value: string, options?: TextOptions) => THREE.Texture;
  dispose: () => void;
};

function canvas(size: number) {
  const element = document.createElement('canvas');
  element.width = element.height = size;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  return { element, ctx };
}

function finish(element: HTMLCanvasElement, color: boolean) {
  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Yellow / graphite hazard chevrons, tiled along the decal's U axis.
function hazardTexture() {
  const size = 256, { element, ctx } = canvas(size);
  ctx.fillStyle = '#c9a323';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#171a1f';
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 4);
  for (let i = -size; i < size; i += 64) ctx.fillRect(i, -size, 32, size * 2);
  ctx.restore();
  // wear: a scatter of faint scratches so the paint is not perfectly clean
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = i % 3 ? '#ffffff' : '#4a4436';
    ctx.fillRect(Math.random() * size, Math.random() * size, Math.random() * 26 + 4, 1.5);
  }
  ctx.globalAlpha = 1;
  return finish(element, true);
}

// Radial falloff used for lamp pools and beacon sprites (white core -> transparent).
function glowTexture() {
  const size = 256, { element, ctx } = canvas(size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.28, 'rgba(255,244,224,0.55)');
  gradient.addColorStop(0.62, 'rgba(255,236,205,0.16)');
  gradient.addColorStop(1, 'rgba(255,232,200,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finish(element, true);
}

// Fake contact occlusion: opaque centre fading to nothing at the rim.
function aoTexture() {
  const size = 256, { element, ctx } = canvas(size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.72)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  gradient.addColorStop(0.78, 'rgba(0,0,0,0.08)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finish(element, false);
}

// Restrained brush noise, used as a roughness map so metal reads as machined.
function brushTexture() {
  const size = 256, { element, ctx } = canvas(size);
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 520; i++) {
    const shade = 120 + Math.floor(Math.random() * 90);
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.12 + Math.random() * 0.3})`;
    ctx.lineWidth = Math.random() < 0.7 ? 1 : 2;
    const x = Math.random() * size, y = Math.random() * size;
    const length = 20 + Math.random() * 120, angle = (Math.random() - 0.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  const texture = finish(element, false);
  texture.repeat.set(4, 4);
  return texture;
}

function textTexture(value: string, options: TextOptions = {}) {
  const px = options.px ?? 64;
  const tracking = options.tracking ?? Math.round(px * 0.1);
  const measure = canvas(8);
  measure.ctx.font = `${options.weight ?? 700} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const width = Math.ceil(measure.ctx.measureText(value).width + tracking * value.length + px);
  const element = document.createElement('canvas');
  element.width = Math.max(64, width);
  element.height = Math.ceil(px * 1.7);
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  ctx.clearRect(0, 0, element.width, element.height);
  ctx.font = `${options.weight ?? 700} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = options.color ?? '#f2f4f6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${tracking}px`; } catch { /* letterSpacing unsupported */ }
  ctx.fillText(value, element.width / 2, element.height / 2);
  const texture = finish(element, true);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createTextures(): TextureSet {
  const owned: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(texture: T) => { owned.push(texture); return texture; };
  const hazard = track(hazardTexture());
  const glow = track(glowTexture());
  const ao = track(aoTexture());
  const brush = track(brushTexture());
  hazard.repeat.set(1, 1);
  return {
    hazard, glow, ao, brush,
    text: (value, options) => track(textTexture(value, options)),
    dispose: () => owned.forEach((texture) => texture.dispose()),
  };
}
