// Head-less smoke test for the hard-surface geometry layer.
//   node_modules/.bin/tsx scripts/hardsurface-smoke.ts
// Stubs just enough DOM for the canvas textures, then builds the whole diorama
// and reports part / triangle / draw-call budget numbers.
import assert from 'node:assert/strict';
import * as THREE from 'three';

type FakeContext = Record<string, unknown>;

const gradient = { addColorStop() {} };

function makeCanvas() {
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => context,
    toDataURL: () => 'data:,',
    addEventListener() {},
    removeEventListener() {},
  };
  const context: FakeContext = new Proxy({ canvas } as FakeContext, {
    get(target, key) {
      if (key in target) return target[key as string];
      if (key === 'measureText') return () => ({ width: 48 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      return () => undefined;
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  });
  return canvas;
}

(globalThis as unknown as { document: unknown }).document = {
  createElement: () => makeCanvas(),
  createElementNS: () => makeCanvas(),
  location: { href: 'http://localhost/' },
};

async function main() {
  const { buildDiorama } = await import('../lib/hardsurface/diorama');
  const started = Date.now();
  const diorama = buildDiorama();
  const buildMs = Date.now() - started;
  diorama.root.updateMatrixWorld(true);
  const vehicle = diorama.byId.get('vehicle-body')!;
  const ray = new THREE.Raycaster(vehicle.centre.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(vehicle.group.children[0], true).length, 0, 'visual meshes must not duplicate picking work');
  assert.ok(ray.intersectObject(vehicle.pick).length > 0, 'coarse proxy must still select the car');

  let visualMeshes = 0;
  let invisible = 0;
  let decorative = 0;
  diorama.root.traverse((object) => {
    const mesh = object as { isMesh?: boolean; visible?: boolean; raycast?: unknown; material?: { visible?: boolean } };
    if (!mesh.isMesh) return;
    if (mesh.raycast === undefined) return;
    visualMeshes += 1;
    if (mesh.material && mesh.material.visible === false) invisible += 1;
    if ((object as { userData?: { moduleId?: string } }).userData?.moduleId === undefined && mesh.material?.visible !== false) {
      // decorative helpers (beams, pools, ao blobs, rocks instanced are separate)
      if (!(object as { isInstancedMesh?: boolean }).isInstancedMesh) decorative += 1;
    }
  });

  console.log('build ms        :', buildMs);
  console.log('modules         :', diorama.modules.length);
  console.log('parts (raw)     :', diorama.stats.parts);
  console.log('triangles       :', diorama.stats.triangles.toLocaleString());
  console.log('meshes / draws  :', visualMeshes, `(invisible pick proxies: ${invisible}, helper meshes: ${decorative})`);
  console.log('');
  console.log('id'.padEnd(24), 'parts'.padStart(6), 'draws'.padStart(6), 'tris'.padStart(9), 'size (m)');
  for (const mod of diorama.modules) {
    let draws = 0;
    let tris = 0;
    mod.group.traverse((object) => {
      const mesh = object as { isMesh?: boolean; geometry?: { index?: { count: number } | null; attributes?: { position?: { count: number } } }; material?: { visible?: boolean } };
      if (!mesh.isMesh || !mesh.geometry || mesh.material?.visible === false) return;
      draws += 1;
      tris += mesh.geometry.index ? mesh.geometry.index.count / 3 : (mesh.geometry.attributes?.position?.count ?? 0) / 3;
    });
    const size = mod.size.map((value) => value.toFixed(2)).join(' × ');
    console.log(mod.id.padEnd(24), String(mod.parts).padStart(6), String(draws).padStart(6), String(Math.round(tris)).padStart(9), size);
  }

  const finite = diorama.modules.every((mod) => mod.size.every((value) => Number.isFinite(value) && value >= 0));
  console.log('');
  console.log('all module boxes finite:', finite);
  console.log('lamps                   :', diorama.lamps.length, 'live:', diorama.lamps.filter((lamp) => lamp.spot).length);
  console.log('labels                  :', diorama.labels.length);

  if (!finite) throw new Error('non-finite module box');
  if (diorama.stats.triangles > 900_000) throw new Error('triangle budget blown');
  diorama.dispose();
  console.log('\nOK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
