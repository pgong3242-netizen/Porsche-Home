import * as THREE from 'three';

export function createResearchParking(source: THREE.Group, sourcePaint: THREE.Material) {
  const row = new THREE.Group();
  row.name = 'jiangqiao-parked-porsches';
  ['#c8cdd0', '#456755'].forEach((color, index) => {
    const car = source.clone(true);
    const materials = new Map<THREE.Material, THREE.Material>();
    car.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const recolor = (material: THREE.Material) => {
        if (!materials.has(material)) {
          const copy = material.clone();
          if (material === sourcePaint && copy instanceof THREE.MeshStandardMaterial) copy.color.set(color);
          materials.set(material, copy);
        }
        return materials.get(material)!;
      };
      node.material = Array.isArray(node.material) ? node.material.map(recolor) : recolor(node.material);
    });
    car.name = '911 Carrera 4S';
    car.userData.parkingColor = color;
    car.visible = true;
    car.position.set(-2 + index * 4, .36, 12.1);
    car.rotation.set(0, 0, 0);
    row.add(car);
  });
  return row;
}

// Geometry and textures remain owned by the main scene; only paint/material copies are ours.
export function disposeResearchParking(row: THREE.Group) {
  const materials = new Set<THREE.Material>();
  row.traverse(node => {
    if (node instanceof THREE.Mesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
  });
  materials.forEach(material => material.dispose());
}
