import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { yieldToBrowser } from './scene-loading';

// Merge only static siblings: parent transforms and independently visible groups survive.
export async function mergeStaticMeshes(root: THREE.Object3D, stopped: () => boolean) {
  const parents: THREE.Object3D[] = [];
  root.traverse(node => { if (node.children.length) parents.push(node); });
  for (const parent of parents) {
    if (stopped()) return;
    const batches = new Map<string, THREE.Mesh[]>();
    for (const node of parent.children) {
      if (!(node instanceof THREE.Mesh) || node instanceof THREE.InstancedMesh || node instanceof THREE.SkinnedMesh ||
          node.children.length || !node.visible || Array.isArray(node.material) || node.material.transparent) continue;
      const attributes = Object.keys(node.geometry.attributes).map(name => {
        const attr = node.geometry.getAttribute(name);
        return `${name}:${attr.itemSize}:${attr.normalized}`;
      }).sort().join(',');
      const key = `${node.material.uuid}:${node.castShadow}:${node.receiveShadow}:${node.renderOrder}:${node.layers.mask}:${!!node.geometry.index}:${attributes}`;
      const batch = batches.get(key) ?? [];
      batch.push(node);batches.set(key, batch);
    }
    for (const nodes of batches.values()) {
      if (nodes.length < 2) continue;
      const geometries = nodes.map(node => { node.updateMatrix();return node.geometry.clone().applyMatrix4(node.matrix); });
      const geometry = mergeGeometries(geometries);
      geometries.forEach(item => item.dispose());
      if (!geometry) continue;
      const first = nodes[0];
      const merged = new THREE.Mesh(geometry, first.material);
      merged.name = 'static-batch';
      merged.castShadow = first.castShadow;merged.receiveShadow = first.receiveShadow;
      merged.renderOrder = first.renderOrder;merged.layers.mask = first.layers.mask;
      parent.add(merged);
      for (const node of nodes) parent.remove(node);
    }
    await yieldToBrowser();
  }
}
