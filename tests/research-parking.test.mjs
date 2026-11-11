import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const THREE = require('three');
function load(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name === './car-geometry' ? load('../lib/car-geometry.ts') : require(name), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { createResearchParking, disposeResearchParking } = load('../lib/research-parking.ts');
const { createConceptCar } = load('../lib/car-geometry.ts');

function importedCarEnvelope() {
  const binary = readFileSync(new URL('../public/models/porsche-911-carrera-4s.glb', import.meta.url));
  const gltf = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)).toString());
  const bounds = new THREE.Box3();
  function visit(index, parent) {
    const node = gltf.nodes[index];
    if (node.name === 'Plane') return;
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3(...(node.translation || [0, 0, 0])),
      new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1])),
      new THREE.Vector3(...(node.scale || [1, 1, 1])),
    );
    const world = parent.clone().multiply(local);
    for (const primitive of gltf.meshes?.[node.mesh]?.primitives || []) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      bounds.union(new THREE.Box3(new THREE.Vector3(...accessor.min), new THREE.Vector3(...accessor.max)).applyMatrix4(world));
    }
    for (const child of node.children || []) visit(child, world);
  }
  for (const root of gltf.scenes[gltf.scene || 0].nodes) visit(root, new THREE.Matrix4());
  const size = bounds.getSize(new THREE.Vector3());
  size.multiplyScalar(4.75 / size.z);
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#466b82' });
  const envelope = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), paint);
  envelope.position.y = size.y / 2;
  group.add(envelope);
  return { group, paint };
}

for (const [name, model] of [['fallback', createConceptCar('#466b82')], ['Carrera 4S', importedCarEnvelope()]]) {
  test(`${name}: two cars clear the building and each other`, () => {
    const source = model.group;
    source.position.set(3.12, .255, .25);
    source.rotation.y = -.06;
    source.visible = false;
    const row = createResearchParking(source, model.paint);
    assert.equal(row.children.length, 2);
    assert.equal(new Set(row.children.map(car => car.name)).size, 1);
    assert.equal(new Set(row.children.map(car => car.userData.parkingColor)).size, 2);
    assert.equal(model.paint.color.getHexString(), '466b82', 'source paint is unchanged');
    for (const car of row.children) {
      const paints = [];
      car.traverse(node => { if (node instanceof THREE.Mesh) {
        for (const material of [node.material].flat()) if (material.color?.getHexString() === car.userData.parkingColor.slice(1)) paints.push(material);
      } });
      assert(paints.length > 0, 'each vehicle actually uses its assigned paint');
    }
    const boxes = row.children.map(car => new THREE.Box3().setFromObject(car));
    // Includes the front canopy, benches and chargers; cars must stay beyond all of them.
    for (const [index, box] of boxes.entries()) {
      assert(box.min.z > 9.5, 'clear the facade, furniture and front garden trees');
      assert(box.max.z < 15.5, 'remain on the new apron');
      assert(box.min.x > -6.5 && box.max.x < 6.5);
      assert(box.min.y >= .34, 'stay above paving');
      assert.equal(row.children[index].visible, true);
      for (const other of boxes.slice(index + 1)) assert(!box.intersectsBox(other));
    }
    assert.deepEqual(source.position.toArray(), [3.12, .255, .25]);
    assert.equal(source.visible, false, 'preserve the original vehicle state');
    let sourceDisposed = false;
    model.paint.addEventListener('dispose', () => { sourceDisposed = true; });
    source.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.addEventListener('dispose', () => { sourceDisposed = true; }); });
    disposeResearchParking(row);
    assert.equal(sourceDisposed, false, 'replacing the parking row must not dispose the main car');
  });
}


test('Jiangqiao hides the complete entrance while the owner home retains it', () => {
  const { addWorldDetails } = load('../lib/world-details.ts');
  const context = new Proxy({}, { get: () => () => {} });
  const previousDocument = globalThis.document, previousPath = globalThis.Path2D;
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  globalThis.Path2D = class {};
  try {
    const world = new THREE.Group(), home = new THREE.Group();
    const details = addWorldDetails(world, home);
    const entrance = world.getObjectByName('garden-entrance');
    assert(entrance.children.length > 10);
    const bounds = new THREE.Box3().setFromObject(entrance);
    assert(bounds.max.y > 4, 'the overhead gate beam belongs to the entrance group');
    details.setCampus('porsche-rd');
    assert.equal(entrance.visible, false);
    details.setCampus(undefined);
    assert.equal(entrance.visible, true);
    details.dispose();
  } finally {
    globalThis.document = previousDocument;
    globalThis.Path2D = previousPath;
  }
});


test('world details do not recreate the outer ring of trees', () => {
  const { addWorldDetails } = load('../lib/world-details.ts');
  const context = new Proxy({}, { get: () => () => {} });
  const previousDocument = globalThis.document, previousPath = globalThis.Path2D;
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  globalThis.Path2D = class {};
  try {
    const world = new THREE.Group(), home = new THREE.Group();
    const details = addWorldDetails(world, home);
    try {
      const perimeter = world.children.filter(node => {
        const { x, z } = node.position;
        return node instanceof THREE.Mesh && ['CylinderGeometry','IcosahedronGeometry'].includes(node.geometry.type) && (x / 48) ** 2 + (z / 43) ** 2 > .9;
      });
      assert.equal(perimeter.length, 0, 'no tree trunks, crowns or decorative flowers around the outer boundary');
      assert(world.getObjectByName('garden-entrance'), 'keep the entrance');
      assert.equal(world.children.filter(node=>node.name==='garden-rest-area').length,2);
      const trees=world.getObjectByName('courtyard-trees');
      assert.equal(trees.children.length,2);
      for(const batch of trees.children) {assert(batch instanceof THREE.InstancedMesh);assert.equal(batch.count,10);}
      details.setCampus('porsche-rd');
      const street=home.getObjectByName('porsche-street');
      assert(street);
      const road=new THREE.Box3().setFromObject(street);
      const size=road.getSize(new THREE.Vector3());
      assert(size.z>size.x*8,'street runs longitudinally');
      assert(Math.abs(size.z-60)<.001,'street ends shortly beyond the buildings and parking');
      const campus=home.getObjectByName('porsche-rd');
      for(const [name,width,front] of [['research-offices',8.08,-1],['research-laboratory',10.5,3]]) {
        const building=campus.getObjectByName(name);
        assert(building);
        const bounds=new THREE.Box3().setFromObject(building);
        const size=bounds.getSize(new THREE.Vector3());
        assert(Math.abs(size.z-36)<.001,'building and foundation length triples from 12 to 36');
        assert(Math.abs(size.x-width)<.001,'building width is unchanged');
        assert(Math.abs(bounds.max.z-front)<.001,'front edge stays clear of parking');
      }
      for(const object of campus.children) {
        if(object===street)continue;
        const bounds=new THREE.Box3().setFromObject(object);
        assert(bounds.max.x<road.min.x || bounds.min.x>road.max.x || bounds.max.z<road.min.z || bounds.min.z>road.max.z,
          'buildings, foundations and parking fixtures must not occupy the street');
      }

    } finally { details.dispose(); }
  } finally {
    globalThis.document = previousDocument;
    globalThis.Path2D = previousPath;
  }
});
