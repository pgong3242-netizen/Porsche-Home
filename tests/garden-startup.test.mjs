import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const THREE = require('three');
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const config = { architecture:'alpine',plants:'pine',time:'day',weather:'clear',carColor:'#466b82',wheels:'silver' };

async function mount(view, active=true, campus) {
  const effects = [], refs = [], frames = new Map(), loaded = [];
  let scene, resolveCar, rejectCar, conceptCar, ready = false, nextFrame = 0;
  const context = new Proxy({}, { get: () => () => {} });
  const host = { clientWidth:1200,clientHeight:800,dataset:{},appendChild(){} };
  const canvas = () => ({style:{},addEventListener(){},removeEventListener(){},remove(){},getContext:()=>context});
  const globals = { document:globalThis.document,Path2D:globalThis.Path2D,window:globalThis.window,matchMedia:globalThis.matchMedia,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame };
  globalThis.document={hidden:false,createElement:canvas};globalThis.Path2D=class {};
  globalThis.window={devicePixelRatio:1};globalThis.matchMedia=()=>({matches:true});
  globalThis.ResizeObserver=class {observe(){} disconnect(){}};
  globalThis.requestAnimationFrame=callback=>{frames.set(++nextFrame,callback);return nextFrame;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  class Renderer {
    domElement=canvas();shadowMap={};
    setPixelRatio(){}setSize(){}dispose(){}initTexture(){}
    async compileAsync(value){if(value instanceof THREE.Scene)scene=value;}
    render(value){scene=value;}
  }
  class Controls extends THREE.EventDispatcher {
    target=new THREE.Vector3();update(){}dispose(){}
  }
  const react={...require('react'),useEffect:fn=>effects.push(fn),useState:value=>[value,()=>{}],useRef:value=>{
    const ref={current:refs.length===0?host:value};refs.push(ref);return ref;
  }};
  const cache = new Map();
  function load(file) {
    if(cache.has(file))return cache.get(file);
    const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    const mod={exports:{}};cache.set(file,mod.exports);
    new Function('require','module','exports',code)(id=>{
      if(id==='react')return react;
      if(id==='three')return {...THREE,WebGLRenderer:Renderer,PMREMGenerator:class {fromScene(){return {texture:new THREE.Texture(),dispose(){}};}dispose(){}}};
      if(id.includes('OrbitControls'))return {OrbitControls:Controls};
      if(id.includes('RoomEnvironment'))return {RoomEnvironment:class {dispose(){}}};
      if(id.endsWith('car-geometry')){const actual=load(resolve(root,'lib/car-geometry.ts'));return {...actual,createConceptCar:(...args)=>{conceptCar=actual.createConceptCar(...args);return conceptCar;}};}
      if(id.endsWith('gt3-rs'))return {loadGt3RsDisplay:()=>{loaded.push('car');return new Promise((resolve,reject)=>{resolveCar=resolve;rejectCar=reject;});}};
      if(id.endsWith('workshop-catalog'))return {workshopModels:[{id:'carrera-4s',name:'Carrera'},{id:'technic-42096',name:'RSR',create:()=>new Promise(()=>{})}]};
      if(id.startsWith('.'))return load(resolve(dirname(file),id+'.ts'));
      return require(id);
    },mod,mod.exports);
    return mod.exports;
  }
  let cleanups=[];
  try {
    const component=load(resolve(root,'components/GardenScene.tsx')).default;
    component({config,view,campus,workshopModelId:'carrera-4s',explode:1,active,pet:'none',onReady:()=>{ready=true;}});
    cleanups=effects.map(fn=>fn()).filter(fn=>typeof fn==='function');
    const deadline=Date.now()+10000;
    while(!frames.size && Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
    assert(frames.size,'initialization schedules a frame');
    const [id,frame]=frames.entries().next().value;frames.delete(id);frame(performance.now());
    assert(!ready,'loading stays visible until the 911 is prepared');
    assert.equal(conceptCar.group.visible,false,'temporary car must not flash during loading');
    let meshes=0;scene.traverse(node=>{if(node instanceof THREE.Mesh)meshes++;});
    return {meshes,scene,loaded,conceptCar,get ready(){return ready;},runtime:refs[1].current,
      async failCar(){
        const deadline=Date.now()+10000;
        while(!rejectCar&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
        assert(rejectCar);rejectCar(new Error("test download failure"));
        while(!host.dataset.carModel&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
        assert.equal(host.dataset.carModel,"concept-fallback");
      },
      async finishCar(){
        const deadline=Date.now()+10000;
        while(!resolveCar&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
        assert(resolveCar);
        const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,4),new THREE.MeshStandardMaterial()));
        resolveCar({group,parts:[],paint:new THREE.MeshStandardMaterial(),rims:[]});
        while(!host.dataset.carModel&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
        assert.equal(host.dataset.carModel,'gt3-rs');
      },
      tick(time=performance.now()){const [id,callback]=frames.entries().next().value;frames.delete(id);callback(time);},
      async close(){cleanups.forEach(fn=>fn());await new Promise(r=>setTimeout(r,10));Object.assign(globalThis,globals);},frames};
  } catch(error) {
    cleanups.forEach(fn=>fn());Object.assign(globalThis,globals);throw error;
  }
}

test('direct garage startup skips landscape construction and keeps one canvas runtime', async () => {
  const app=await mount('workshop');
  try {
    assert(app.meshes<400,`garage created ${app.meshes} meshes`);
    assert.equal(app.scene.getObjectByName('garden-entrance'),undefined);
    assert.equal(app.scene.getObjectByName('porsche-rd'),undefined);
    app.runtime.setView('home');
    const deadline=Date.now()+10000;
    while(!app.scene.getObjectByName('garden-entrance')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
    assert(app.scene.getObjectByName('garden-entrance'),'landscape is built when first visited');
    app.runtime.setView('workshop');app.runtime.setView('home');
    let entrances=0;app.scene.traverse(node=>{if(node.name==='garden-entrance')entrances++;});
    assert.equal(entrances,1,'return visits reuse the landscape');
  } finally {await app.close();}
});

test('home startup does not construct unvisited campuses', async () => {
  const app=await mount('home');
  try {
    assert(app.scene.getObjectByName('garden-entrance'));
    assert.equal(app.scene.getObjectByName('porsche-china'),undefined);
    assert.equal(app.scene.getObjectByName('porsche-rd'),undefined);
    assert(app.meshes<700,`home created ${app.meshes} meshes`);
    let ground;
    app.scene.traverse(node=>{if(node instanceof THREE.Mesh && node.geometry.parameters?.width===85 && node.geometry.parameters?.height===80)ground=node;});
    assert(ground,'garden ground has half the previous width and depth');
    ground.geometry.computeBoundingBox();
    assert(ground.geometry.boundingBox.max.y>1,'mountain relief remains');
    console.log(`Prepared home meshes: ${app.meshes}`);
  } finally {await app.close();}
});

test('courtyard omits collectible machinery and garage keeps it across visits', async () => {
  const app=await mount('home');
  try {
    await app.finishCar();app.tick();
    assert.equal(app.scene.getObjectByName('part-modules'),undefined);
    app.runtime.setView('workshop');app.tick();
    const modules=app.scene.getObjectByName('part-modules');
    assert(modules?.visible);
    assert(modules.getObjectByName('module-engine'));
    app.runtime.setView('home');app.tick();
    assert.equal(modules.visible,false);
    app.runtime.setView('workshop');app.tick();
    assert.equal(app.scene.getObjectByName('part-modules'),modules);
    assert.equal(modules.visible,true);
  } finally {await app.close();}
});


test('settled garage skips scene updates and resumes after refresh', async () => {
  const app=await mount('workshop');
  try {
    await app.finishCar();
    const time=performance.now()+3000;
    for(let i=0;i<400;i++)app.tick(time+i*17);
    let updates=0;
    const lerp=app.scene.background.lerp;
    app.scene.background.lerp=function(...args){updates++;return lerp.apply(this,args);};
    for(let i=0;i<60;i++)app.tick(time+7000+i*17);
    assert.equal(updates,0,'idle garage does not update lighting or traverse assembly parts');
    app.runtime.refresh();app.tick(time+9000);
    assert.equal(updates,1,'refresh resumes scene updates');
  } finally {await app.close();}
});

test('loading reveals the 911 even while the loading overlay keeps the scene inactive', async () => {
  const app=await mount('home',false);
  try {
    app.tick();assert.equal(app.ready,false);
    await app.finishCar();app.tick();
    assert.equal(app.ready,true);
    assert.equal(app.conceptCar.group.visible,false);
  } finally {await app.close();}
});

test('failed car download exits loading with the fallback car', async () => {
  const app=await mount('home');
  try {
    await app.failCar();app.tick();
    assert.equal(app.ready,true);
    assert.equal(app.conceptCar.group.visible,true);
  } finally {await app.close();}
});

test('courtyard perimeter trees stay removed for saved plant configurations', async () => {
  const app=await mount('home');
  try {
    for(const plants of ['pine','olive','cypress']) {
      app.runtime.setConfig({...config,plants});
      let trees=0;
      app.scene.traverse(node=>{if(node instanceof THREE.Group && Math.abs(node.position.y-.16)<.0001 && Math.abs(node.position.x)>=8.7)trees++;});
      assert.equal(trees,0,plants);
    }
  } finally {await app.close();}
});

test('Jiangqiao builds flat industrial ground without meadow or garden vegetation', async () => {
  const app=await mount('home',true,'porsche-rd');
  try {
    const ground=app.scene.getObjectByName('industrial-ground');
    assert(ground);assert.equal(ground.geometry.attributes.position.count,4);
    assert.equal(ground.geometry.parameters.width,100);assert.equal(ground.geometry.parameters.height,95);
    assert(app.scene.getObjectByName('porsche-street'));
    let vegetation=0,visibleMeshes=0;
    app.scene.traverseVisible(node=>{if(node instanceof THREE.InstancedMesh)vegetation++;if(node instanceof THREE.Mesh)visibleMeshes++;});
    assert.equal(vegetation,0);
    assert(visibleMeshes<100,`industrial campus draws ${visibleMeshes} meshes`);
  } finally {await app.close();}
});
