import * as THREE from 'three';

// A new task lets loading UI and input run; a resolved Promise does not.
export function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield: () => Promise<void> } }).scheduler;
  return scheduler?.yield ? scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0));
}

export function disposeSceneObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points)) return;
    geometries.add(node.geometry);
    for (const material of [node.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}

export async function prepareSceneObject(
  renderer: THREE.WebGLRenderer, root: THREE.Object3D, camera: THREE.Camera,
  scene: THREE.Scene, stopped: () => boolean,
) {
  await yieldToBrowser();
  if (stopped()) return false;
  await renderer.compileAsync(root, camera, scene);
  if (stopped()) return false;
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points)) return;
    for (const material of [node.material].flat()) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) {
    if (stopped()) return false;
    renderer.initTexture(texture);
    await yieldToBrowser();
  }
  return !stopped();
}
