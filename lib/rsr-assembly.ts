import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { WorkshopExhibit } from './workshop-catalog';

import { rsrChapters, rsrChapterTimes } from './rsr-chapters';
import { disposeSceneObject, yieldToBrowser } from './scene-loading';

// This static model repeats materials per part; parts animate transforms, not materials.
export function reuseRsrMaterials(json: {
  materials: Record<string, unknown>[];
  meshes: { primitives: { material?: number }[] }[];
}) {
  const unique = new Map<string, number>();
  const indices = json.materials.map((material, index) => {
    const properties = { ...material };
    delete properties.name;
    const key = JSON.stringify(properties);
    if (!unique.has(key)) unique.set(key, index);
    return unique.get(key)!;
  });
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    if (primitive.material !== undefined) primitive.material = indices[primitive.material];
  }
}

function addRaceNumbers(group: THREE.Group) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#b11920';
  context.fillRect(0, 0, 256, 192);
  context.fillStyle = '#fff';
  context.font = 'italic 800 117px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('911', 128, 103);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map: texture, roughness: .5, polygonOffset: true, polygonOffsetFactor: -4,
  });

  group.updateMatrixWorld(true);
  for (const door of group.children.filter(node => [66, 78].includes(node.userData.sourceStep))) {
    const sign = door.userData.sourceStep === 66 ? 1 : -1;
    const ray = new THREE.Raycaster(new THREE.Vector3(sign * 1.4, .52, .12), new THREE.Vector3(-sign, 0, 0));
    const hit = ray.intersectObject(door, true).find(result => result.object instanceof THREE.Mesh);
    if (!hit || !(hit.object instanceof THREE.Mesh)) continue;
    const orientation = new THREE.Euler(0, sign * Math.PI / 2, 0);
    const geometry = new DecalGeometry(hit.object, hit.point, orientation, new THREE.Vector3(.27, .19, .17));
    if (geometry.attributes.position.count) door.add(new THREE.Mesh(geometry, material));
    else geometry.dispose();
  }
}

export async function readRsrBytes(response: Response): Promise<ArrayBuffer> {
  if (!response.ok || !response.body) throw new Error('RSR model download failed');
  const bytes = await response.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  // Hosts with Content-Encoding: gzip have already been decoded by fetch.
  if (header[0] !== 0x1f || header[1] !== 0x8b) return bytes;
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export async function loadRsrAssembly(signal?: AbortSignal): Promise<WorkshopExhibit> {
  const bytes = await readRsrBytes(await fetch('./models/42096-rsr.bin', { signal }));
  await yieldToBrowser();
  signal?.throwIfAborted();
  const loader = new GLTFLoader().register(parser => ({
    name: 'RSR_shared_materials',
    beforeRoot() { reuseRsrMaterials(parser.json);return null; },
  }));
  const gltf = await loader.parseAsync(bytes, '');
  if (signal?.aborted) { disposeSceneObject(gltf.scene);signal.throwIfAborted(); }
  await yieldToBrowser();
  const group = gltf.scene.children[0] as THREE.Group;
  addRaceNumbers(group);
  const stages = rsrChapters.map(() => [] as THREE.Object3D[]);
  for (const node of group.children) {
    const step = node.userData.sourceStep;
    const chapter = rsrChapters.findIndex(({ from, to }) => step >= from && step < to);
    stages[chapter].push(node);
    node.userData.part = rsrChapters[chapter].key;
    node.traverse(mesh => {
      if (mesh instanceof THREE.Mesh) mesh.receiveShadow = true;
    });
    if (stages[chapter].length % 12 === 0) await yieldToBrowser();
  }

  const detailTargets = stages.slice(0, 3).map(nodes => {
    const bounds = new THREE.Box3();
    for (const node of nodes) bounds.expandByObject(node);
    return bounds.getCenter(new THREE.Vector3());
  });
  // Center the front-axle shot on the actual axle, rather than the full chassis.
  const frontAxle = stages[1].find(node => node.userData.sourceStep === 18);
  if (frontAxle) new THREE.Box3().setFromObject(frontAxle).getCenter(detailTargets[1]);

  const pistonTarget = detailTargets[2].clone().add(new THREE.Vector3(0, .09, .02));
  const moves = stages.flatMap((nodes, chapter) => {
    const stride = rsrChapters[chapter].weight / nodes.length;
    return nodes.map((node, index) => ({
      node, start: rsrChapterTimes[chapter] + index * stride,
      duration: stride * .86,
      offset: new THREE.Vector3(
        chapter === 2 ? (index % 2 ? .45 : -.45) : 0,
        chapter < 3 ? .42 : .85,
        0,
      ),
    }));
  });

  return {
    group, parts: [],
    assemble(progress) {
      for (const { node, start, duration, offset } of moves) {
        const fraction = THREE.MathUtils.smoothstep(progress, start, start + duration);
        node.visible = progress >= start;
        node.position.copy(offset).multiplyScalar(1 - fraction);
      }
    },
    focus(progress) {
      if (progress >= rsrChapterTimes[3]) return null;
      const index = progress < rsrChapterTimes[1] ? 0 : progress < rsrChapterTimes[2] ? 1 : 2;
      if (index === 2 && progress >= rsrChapterTimes[2] + rsrChapters[2].weight * .49) {
        return { target: pistonTarget, cameraOffset: new THREE.Vector3(-1.16, 1.65, -1.2) };
      }
      return {
        target: detailTargets[index],
        cameraOffset: new THREE.Vector3(index === 2 ? 1.45 : 2.1, index === 2 ? 1.4 : 2.05, index === 1 ? 1.3 : -1.55),
      };
    },
  };
}
