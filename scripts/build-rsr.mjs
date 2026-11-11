// Usage: node scripts/build-rsr.mjs <42096.mpd> <ldraw library dir>
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as THREE from 'three';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const [, , modelFile, libraryDir] = process.argv;
const files = (await readFile(modelFile, 'utf8')).replace(/\r/g, '').split(/(?=^0 FILE )/m).filter(s => s.startsWith('0 FILE '));
const findModel = name => files.find(s => s.startsWith('0 FILE 42096 - ' + name + '.ldr\n'));
const splitSteps = s => s.split(/^0 (?:ROT)?STEP\b.*$/m).map(step => step.split('\n').filter(line => /^1 /.test(line)).join('\n')).filter(Boolean);
const main = splitSteps(findModel('porsche'));
const engine = splitSteps(findModel('engine'));
const chunks = [];
for (const [index, step] of main.entries()) {
  const attachment = step.split('\n').find(line => line.endsWith('42096 - engine.ldr'));
  if (!attachment) {
    chunks.push({ index, data: step, transform: '0 0 0 1 0 0 0 1 0 0 0 1', color: 16 });
    continue;
  }
  const remainder = step.split('\n').filter(line => line !== attachment).join('\n');
  if (remainder) chunks.push({ index, data: remainder, transform: '0 0 0 1 0 0 0 1 0 0 0 1', color: 16 });
  for (const data of engine) chunks.push({ index, data, transform: attachment.split(/\s+/).slice(2, 14).join(' '), color: 0 });
}

const root = ['0 FILE rsr.ldr', ...chunks.map(({ transform, color }, i) => `1 ${color} ${transform} rsr-step-${i}.ldr`)].join('\n');
const submodels = chunks.map(({ data }, i) => `0 FILE rsr-step-${i}.ldr\n0 !LDRAW_ORG Model\n${data}`);
globalThis.ProgressEvent ??= class {};
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(data => { this.result = data; this.onloadend?.(); }); }
};
const embedded = new Map(files.map(file => [file.split('\n')[0].slice(7).replaceAll('\\', '/').toLowerCase(), file]));
globalThis.fetch = async request => {
  const url = new URL(typeof request === 'string' ? request : request.url);
  const path = decodeURIComponent(url.pathname).slice(1).replaceAll('\\', '/');
  const part = embedded.get(path.replace(/^(parts|p)\//, '').toLowerCase());
  if (part) return new Response(part);
  try {
    return new Response(await readFile(resolve(libraryDir, path)));
  } catch {
    return new Response(null, { status: 404 });
  }
};

const loader = new LDrawLoader().setPartsLibraryPath('https://ldraw.local/');
loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);

await loader.preloadMaterials('https://ldraw.local/LDConfig.ldr');
const model = await new Promise((ok, fail) => loader.parse([root, ...submodels, ...files].join('\n'), ok, fail));
model.rotation.x = Math.PI;
model.updateMatrixWorld(true);
if (model.children.length !== chunks.length) throw Error('Assembly step count mismatch');
const bounds = new THREE.Box3().setFromObject(model);
const center = bounds.getCenter(new THREE.Vector3());
const scale = 4.75 / (bounds.max.z - bounds.min.z);
const normalized = new THREE.Matrix4().makeScale(scale, scale, scale)
  .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));

const assembly = new THREE.Group();
for (const [i, step] of model.children.entries()) {
  const batch = new Map();
  step.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    const matrix = normalized.clone().multiply(mesh.matrixWorld);
    const segments = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.attributes.position.count, materialIndex: 0 }];
    for (const { start, count, materialIndex } of segments) {
      const material = Array.isArray(mesh.material) ? mesh.material[materialIndex] : mesh.material;
      const slice = new THREE.BufferGeometry();
      for (const key of ['position', 'normal']) {
        const array = geometry.attributes[key].array.subarray(start * 3, (start + count) * 3);
        slice.setAttribute(key, new THREE.BufferAttribute(new Float32Array(array), 3));
      }
      slice.applyMatrix4(matrix);
      if (!batch.has(material)) batch.set(material, []);
      batch.get(material).push(slice);
    }
  });
  const module = new THREE.Group();
  module.name = `step-${i}`;
  module.userData.sourceStep = chunks[i].index;
  for (const [material, geometries] of batch) {
    const plastic = new THREE.MeshStandardMaterial({
      color: material.color, roughness: .33, transparent: material.transparent,
      opacity: material.opacity, side: material.side,
    });
    module.add(new THREE.Mesh(mergeVertices(mergeGeometries(geometries), .00001), plastic));
  }
  assembly.add(module);
}
const result = await new GLTFExporter().parseAsync(assembly, { binary: true });
// .gz is reserved for negotiated HTTP variants by the production static server.
await writeFile(new URL('../public/models/42096-rsr.bin', import.meta.url), gzipSync(Buffer.from(result), {level: 6}));
console.log(`Exported ${chunks.length} groups; uncompressed ${Math.round(result.byteLength / 1e6)} MB`);
