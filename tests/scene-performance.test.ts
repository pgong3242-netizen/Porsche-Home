import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { disposeSceneObject, prepareSceneObject, yieldToBrowser } from '../lib/scene-loading';
import { mergeStaticMeshes } from '../lib/static-scene';
import { readRsrBytes, reuseRsrMaterials } from '../lib/rsr-assembly';

test('RSR accepts raw gzip and fetch-decoded bodies without double decompression', async () => {
  const bytes = new TextEncoder().encode('glTF example payload');
  for (const response of [
    new Response(gzipSync(bytes)),
    new Response(bytes, { headers: { 'Content-Encoding': 'gzip' } }),
  ]) assert.deepEqual(new Uint8Array(await readRsrBytes(response)), bytes);
  await assert.rejects(readRsrBytes(new Response(null, { status: 404 })), /download failed/);
});

test('yielding gives queued browser tasks time to run', async () => {
  let ran = false;
  setTimeout(() => { ran = true; }, 0);
  await yieldToBrowser();
  assert.equal(ran, true);
});

test('shared geometry, materials and textures are disposed exactly once', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture(), material = new THREE.MeshStandardMaterial({ map: texture });
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const counts = [0, 0, 0];
  [geometry, material, texture].forEach((resource, index) => resource.addEventListener('dispose', () => { counts[index]++; }));
  disposeSceneObject(root);
  assert.deepEqual(counts, [1, 1, 1]);
});

test('cancelled scene preparation never uploads textures or reports ready', async () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const texture = new THREE.Texture();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: texture })));
  let stopped = false, uploads = 0;
  const renderer = {
    async compileAsync() { stopped = true; },
    initTexture() { uploads++; },
  } as unknown as THREE.WebGLRenderer;
  assert.equal(await prepareSceneObject(renderer, scene, camera, scene, () => stopped), false);
  assert.equal(uploads, 0);
  disposeSceneObject(scene);
});

test('static batching preserves geometry, parent motion and transparent objects', async () => {
  const root = new THREE.Group(), gate = new THREE.Group();
  gate.position.x = 4;root.add(gate);
  const material = new THREE.MeshStandardMaterial();
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), material);
    mesh.position.set(i * 2, i / 2, 0);mesh.rotation.y = i / 4;mesh.castShadow = true;
    gate.add(mesh);
  }
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true }));
  gate.add(glass);
  const before = new THREE.Box3().setFromObject(root);
  await mergeStaticMeshes(root, () => false);
  assert.equal(gate.children.length, 2);
  assert.equal(gate.children.includes(glass), true);
  const batch = gate.children.find(child => child.name === 'static-batch') as THREE.Mesh;
  assert.equal(batch.geometry.index!.count / 3, 12 * 12);
  assert.equal(batch.castShadow, true);
  const after = new THREE.Box3().setFromObject(root);
  assert(before.min.distanceTo(after.min) < 0.00001);
  assert(before.max.distanceTo(after.max) < 0.00001);
  gate.position.x += 3;
  assert(Math.abs(new THREE.Box3().setFromObject(root).min.x - after.min.x - 3) < 0.00001);
  disposeSceneObject(root);
});

test('RSR material sharing preserves every primitive and all assembly steps', () => {
  const bytes = gunzipSync(readFileSync(new URL('../public/models/42096-rsr.bin', import.meta.url)));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const before = structuredClone(json);
  reuseRsrMaterials(json);
  const used = new Set<number>();
  const withoutName = (material: Record<string, unknown>) => { const copy = { ...material };delete copy.name;return copy; };
  json.meshes.forEach((mesh: { primitives: { material: number }[] }, i: number) => {
    mesh.primitives.forEach((primitive, j) => {
      used.add(primitive.material);
      const original = before.meshes[i].primitives[j];
      assert.deepEqual(withoutName(json.materials[primitive.material]), withoutName(before.materials[original.material]));
      assert.deepEqual({ ...primitive, material: original.material }, original);
    });
  });
  assert.equal(used.size, 13);
  assert.deepEqual(json.nodes, before.nodes);
  assert.deepEqual(json.accessors, before.accessors);
});
