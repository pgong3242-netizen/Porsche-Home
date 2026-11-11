'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { HomeConfig } from '../lib/home-config';
import { workshopModels, type WorkshopExhibit } from '../lib/workshop-catalog';
import type { createMechanicalAssembly } from '../lib/mechanical-assembly';
import { createConceptCar } from '../lib/car-geometry';
import { createPartModules, type PartModules } from '../lib/part-modules';
import type { DisplayCar } from '../lib/import-car';
import { mergeStaticMeshes } from '../lib/static-scene';
import { disposeSceneObject, prepareSceneObject, yieldToBrowser } from '../lib/scene-loading';
import { addWorldDetails } from '../lib/world-details';
import type { PetKind } from '../lib/demo-world';
import { makeGardenPet } from '../lib/garden-pet';
import { createResearchParking, disposeResearchParking } from '../lib/research-parking';

export type ScenePlace = 'entry'|'map'|'home'|'workshop'|'memories'|'terrace';
type Props = {config:HomeConfig; view:ScenePlace; workshopModelId?:string; campus?:string; explode:number; ownedParts?:readonly string[]; pet?:PetKind; active?:boolean; onReady?:()=>void; onExhibitStatus?:(status:'loading'|'ready'|'error')=>void; onPartSelect?:(part:string)=>void; onPlaceSelect?:(place:ScenePlace)=>void; onLoadingProgress?:(value:number,stage:string)=>void};
type Runtime = {refresh:()=>void; retryExhibit:()=>void; setConfig:(config:HomeConfig)=>void; setView:(view:Props['view'])=>void; setExplode:(n:number)=>void};
const DESTINATIONS: {id:Exclude<ScenePlace,'map'|'entry'>;name:string;subtitle:string;position:[number,number,number]}[] = [
  {id:'home',name:'庭院之家',subtitle:'YOUR HOME',position:[-2,6,-4]},
  {id:'workshop',name:'车库',subtitle:'THE GARAGE',position:[26,5.8,-7]},
];

export default function GardenScene({config,view,workshopModelId,campus,explode,ownedParts,pet='none',active=true,onReady,onExhibitStatus,onPartSelect,onPlaceSelect,onLoadingProgress}:Props) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [exhibitState,setExhibitState] = useState<'loading'|'ready'|'error'>('ready');
  const host=useRef<HTMLDivElement>(null), runtime=useRef<Runtime|null>(null);
  const hotspots=useRef<Record<string,HTMLButtonElement|null>>({});
  const latest=useRef({config,view,workshopModelId,campus,explode,ownedParts,pet,active,onReady,onExhibitStatus,onPartSelect,onPlaceSelect,onLoadingProgress});
  useEffect(()=>{latest.current={config,view,workshopModelId,campus,explode,ownedParts,pet,active,onReady,onExhibitStatus,onPartSelect,onPlaceSelect,onLoadingProgress};});
  useEffect(()=>{
    if(!host.current)return;
    const container=host.current;
    let stopped=false,frame=0;
    const cleanups: (() => void)[] = [];
    const preparations = new Set<Promise<boolean>>();
    const downloads = new AbortController();
    const cleanup = () => {
      stopped=true;
      downloads.abort();
      cancelAnimationFrame(frame);
      runtime.current=null;
      const releases=cleanups.splice(0).reverse();
      // Three.js polls shader programs during compileAsync; keep them alive until it settles.
      void Promise.allSettled([...preparations]).then(()=>{for(const dispose of releases)dispose();});
    };
    async function initialize() {
    await yieldToBrowser();
    if(stopped)return;
    latest.current.onLoadingProgress?.(8,'正在铺开山野与道路');
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{throw new Error('WebGL unavailable');}
    cleanups.push(()=>{renderer.dispose();renderer.domElement.remove();});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.4)); renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none';container.appendChild(renderer.domElement);
    let dirty=true,redrawUntil=0;
    const refresh=()=>{dirty=true;redrawUntil=performance.now()+1800;};
    const scene=new THREE.Scene();scene.background=new THREE.Color('#c1c5b7');scene.fog=new THREE.Fog('#c1c5b7',44,115);
    cleanups.push(()=>disposeSceneObject(scene));
    const pmrem=new THREE.PMREMGenerator(renderer),roomEnvironment=new RoomEnvironment();
    const environment=pmrem.fromScene(roomEnvironment,.04);scene.environment=environment.texture;scene.environmentIntensity=.42;roomEnvironment.dispose();pmrem.dispose();
    cleanups.push(()=>environment.dispose());
    const camera=new THREE.PerspectiveCamera(38,1,.1,500);camera.position.set(21,16,25);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.1,0);controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=6;controls.maxDistance=240;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.18;controls.enablePan=true;controls.screenSpacePanning=false;controls.panSpeed=.7;
    controls.addEventListener('change',()=>{dirty=true;});
    cleanups.push(()=>controls.dispose());
    const prepare = (root:THREE.Object3D) => {
      const task=prepareSceneObject(renderer,root,camera,scene,()=>stopped);
      preparations.add(task);
      void task.then(()=>preparations.delete(task),()=>preparations.delete(task));
      return task;
    };
    const ambient=new THREE.HemisphereLight('#e5e6d7','#596344',1.15);scene.add(ambient);
    const sunlight=new THREE.DirectionalLight('#fff1cd',3.35);sunlight.position.set(-13,24,9);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);sunlight.shadow.camera.left=-50;sunlight.shadow.camera.right=50;sunlight.shadow.camera.top=50;sunlight.shadow.camera.bottom=-50;sunlight.shadow.normalBias=.04;sunlight.shadow.bias=-.00015;scene.add(sunlight);
    cleanups.push(()=>sunlight.shadow.map?.dispose());
    const fill=new THREE.DirectionalLight('#b9d2d7',.45);fill.position.set(12,9,-10);scene.add(fill);
    const materials:THREE.Material[]=[];
    const standard=(color:string,roughness=.85,metalness=0)=>{const mat=new THREE.MeshStandardMaterial({color,roughness,metalness});materials.push(mat);return mat;};
    const stone=standard('#b9ad95'),edgeStone=standard('#a69c83'),concrete=standard('#c8c0ae'),wood=standard('#725b43'),woodLight=standard('#ac9570'),dark=standard('#373b32'),grass=standard('#788363'),leaf=standard('#465f3e'),leafLight=standard('#677b4e'),brass=standard('#88784b',.4,.7);
    const glass=new THREE.MeshPhysicalMaterial({color:'#7c9690',roughness:.1,metalness:.12,transparent:true,opacity:.34,side:THREE.DoubleSide});materials.push(glass);
    const warmGlow=new THREE.MeshStandardMaterial({color:'#f5d9a0',emissive:'#ffd78d',emissiveIntensity:1.2,roughness:.7});materials.push(warmGlow);
    const water=new THREE.MeshPhysicalMaterial({color:'#6a9b96',roughness:.19,metalness:.25,transparent:true,opacity:.87,clearcoat:1});materials.push(water);
    const allFixtures:THREE.PointLight[]=[];
    function mesh(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0,shadow=true){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
    function box(parent:THREE.Object3D,material:THREE.Material,w:number,h:number,d:number,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z);}
    function cylinder(parent:THREE.Object3D,material:THREE.Material,r:number,h:number,x=0,y=0,z=0,segments=12){return mesh(new THREE.CylinderGeometry(r,r,h,segments),material,parent,x,y,z);}
    function sphere(parent:THREE.Object3D,material:THREE.Material,r:number,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=mesh(new THREE.IcosahedronGeometry(r,1),material,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
    let seed=83;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
    const terrain=new THREE.Group();scene.add(terrain);
    const island=new THREE.Group();scene.add(island);
    const world=new THREE.Group();scene.add(world);
    const architecture=new THREE.Group();island.add(architecture);
    const buildings:Record<HomeConfig['architecture'],THREE.Group>={courtyard:new THREE.Group(),pavilion:new THREE.Group(),alpine:new THREE.Group()};
    const carport=new THREE.Group();carport.position.set(3.15,0,.25);island.add(carport);
    function glow(parent:THREE.Object3D,x:number,y:number,z:number,intensity=5){const p=new THREE.PointLight('#ffdca3',intensity,7,2);p.position.set(x,y,z);parent.add(p);allFixtures.push(p);return p;}
    // A freestanding workshop: the open forecourt keeps all exploded parts in view.
    const workshop=new THREE.Group();workshop.position.set(26,0,-6);world.add(workshop);
    box(workshop,edgeStone,14,.24,16,0,.06,0);box(workshop,stone,13.6,.1,15.6,0,.23,0);
    box(workshop,concrete,12,4.1,.25,0,2.35,-5.8);box(workshop,wood,12.6,.22,4.6,0,4.58,-4.15);
    box(workshop,dark,.16,4.3,4.7,-5.9,2.4,-4.15);box(workshop,glass,.06,4.1,5.3,5.9,2.35,-3.35);
    for(let i=0;i<10;i++)box(workshop,woodLight,.13,.1,4.4,-5.6+i*1.24,4.42,-4.15);
    box(workshop,warmGlow,10.7,.035,.055,0,4.23,-5.6);glow(workshop,0,3.4,-4,8);
    box(workshop,wood,4.3,.17,1.05,-2.4,1.25,-4.65);for(const x of[-4.15,-.65])box(workshop,dark,.08,1.08,.7,x,.64,-4.65);
    box(workshop,dark,2.6,1.8,1.1,3.3,1.2,-4.7);for(let i=0;i<5;i++)box(workshop,brass,.65,.025,.04,3.3,.56+i*.29,-4.13);
    box(workshop,dark,3.8,1.6,.08,-2.4,2.7,-5.62);for(let i=0;i<7;i++){box(workshop,brass,.06,.46,.06,-3.8+i*.47,2.85,-5.51);cylinder(workshop,brass,.07,.12,-3.8+i*.47,1.4,-4.5,10);}
    cylinder(workshop,standard('#7e8676'),4.7,.15,0,.36,2.05,64);cylinder(workshop,standard('#b7b4a4'),4.45,.035,0,.46,2.05,64);
    for(const x of[-5.8,5.8]){box(workshop,dark,.09,2.5,.09,x,1.55,4.5);box(workshop,warmGlow,.34,.09,.34,x,2.83,4.5);}
    let landscapeReady=false;
    let worldDetails: ReturnType<typeof addWorldDetails> | undefined;
    let applyGardenConfig: ((config:HomeConfig)=>void) | undefined;
    cleanups.push(()=>worldDetails?.dispose());
    let landscapeLoading: Promise<void> | undefined;
    const ensureLandscape = () => landscapeLoading ??= buildLandscape();
    async function buildLandscape() {
    if(latest.current.campus==='porsche-rd') {
      const ground=mesh(new THREE.PlaneGeometry(100,95),standard('#686d71'),terrain,0,-.025,0,false);
      ground.rotation.x=-Math.PI/2;ground.name='industrial-ground';
      worldDetails=addWorldDetails(world,island);worldDetails.setCampus('porsche-rd');
      island.children.forEach(child=>{child.visible=child.name==='porsche-rd';});
      await mergeStaticMeshes(island,()=>stopped);
      return;
    }
    const terrainHeight=(x:number,z:number)=>{
      const radius=Math.hypot(x/45,z/37);
      const edge=THREE.MathUtils.smoothstep(radius,1,1.55);
      const approach=1-THREE.MathUtils.smoothstep(Math.abs(x-6),4,13)
        *THREE.MathUtils.smoothstep(z,27,40)*(1-THREE.MathUtils.smoothstep(z,56,69));
      const ridge=4.9*Math.exp(-((x-38)**2/425+(z+29)**2/370));
      const basin=-3.1*Math.exp(-((x+39)**2/325+(z-17)**2/290));
      return -.025+edge*approach*(ridge+basin+1.85*Math.sin(x*.065)*Math.cos(z*.073));
    };
    const groundGeometry=new THREE.PlaneGeometry(85,80,56,54);
    groundGeometry.rotateX(-Math.PI/2);
    const groundVertices=groundGeometry.attributes.position;
    for(let i=0;i<groundVertices.count;i++){
      groundVertices.setY(i,terrainHeight(groundVertices.getX(i),groundVertices.getZ(i)));
    }
    groundGeometry.computeVertexNormals();
    mesh(groundGeometry,grass,terrain,0,0,0,false).castShadow=false;
    const horizon=mesh(new THREE.CircleGeometry(140,64),grass,terrain,0,-4.8,0,false);
    horizon.rotation.x=-Math.PI/2;
    horizon.castShadow=false;

    latest.current.onLoadingProgress?.(16,'正在铺开草地');
    await yieldToBrowser();if(stopped)return;
    // Scatter low meadow plants in patches, leaving the approach and sightlines clear.
    const meadowPatches=[
      [-11,10],[-15,22],[-28,10],[-30,-5],[-24,-26],
      [-11,-24],[3,-19],[14,-15],[23,6],[14,16],[1,21],
      [-38,13],[-36,-31],[32,-30],[39,21],
    ];
    const meadowCount=meadowPatches.length*22;
    const meadowStems=new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.022,.034,.53,5),
      standard('#607a46'),meadowCount,
    );
    const meadowBlooms=new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(.16,0),
      standard('#ffffff'),meadowCount,
    );
    const meadowGrasses=new THREE.InstancedMesh(
      new THREE.ConeGeometry(.14,.7,4),standard('#82945c'),meadowCount,
    );
    const flowerColors=['#f5df9b','#f7eee1','#b395c6','#d89491','#eee6bd'];
    const plant=new THREE.Object3D();
    const flowerColor=new THREE.Color();
    let flowerIndex=0;
    for(const [cx,cz] of meadowPatches){
      for(let i=0;i<22;i++){
        const x=cx+(rand()-.5)*5,z=cz+(rand()-.5)*3;
        const y=terrainHeight(x,z),size=.65+rand()*.8;
        plant.rotation.set(0,rand()*Math.PI*2,0);
        plant.scale.setScalar(size);
        plant.position.set(x,y+.265*size,z);
        plant.updateMatrix();
        meadowStems.setMatrixAt(flowerIndex,plant.matrix);
        plant.scale.set(size,size*.45,size);
        plant.position.y=y+.53*size;
        plant.updateMatrix();
        meadowBlooms.setMatrixAt(flowerIndex,plant.matrix);
        meadowBlooms.setColorAt(flowerIndex,flowerColor.set(flowerColors[Math.floor(rand()*flowerColors.length)]));
        const grassX=x+.28,grassZ=z-.21;
        plant.position.set(grassX,terrainHeight(grassX,grassZ)+.29*size,grassZ);
        plant.scale.set(.85,size,.85);
        plant.rotation.z=.22;
        plant.updateMatrix();
        meadowGrasses.setMatrixAt(flowerIndex,plant.matrix);
        flowerIndex++;
      }
    }
    terrain.add(meadowStems,meadowBlooms,meadowGrasses);
    latest.current.onLoadingProgress?.(23,'正在布置公共空间');
    await yieldToBrowser();if(stopped)return;
    const pathMat=standard('#b7a88c'),pathEdge=standard('#9c947b');
    function path(points:[number,number][],width=1.65,closed=false){
      const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.035,z)),closed),positions:number[]=[],indices:number[]=[];
      for(let i=0;i<=70;i++){
        const t=i/70,p=curve.getPoint(t),direction=curve.getTangent(t),normal=new THREE.Vector3(-direction.z,0,direction.x).multiplyScalar(width/2);
        positions.push(p.x+normal.x,p.y,p.z+normal.z,p.x-normal.x,p.y,p.z-normal.z);
        if(i<70){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
      const ribbon=mesh(geo,pathMat,world);ribbon.castShadow=false;
      for(const side of[-1,1]){
        const edgePoints=Array.from({length:45},(_,i)=>{const t=i/44,p=curve.getPoint(t),d=curve.getTangent(t);return p.add(new THREE.Vector3(-d.z,0,d.x).multiplyScalar(side*width/2));});
        const edging=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePoints),44,.045,5,false),pathEdge,world);edging.castShadow=false;
      }
    }
    // A continuous garden loop passes the four destinations on their public sides.
    path([
      [9,9],[14,12],[22,11],[28,5],[19,-1],[15,-11],
      [5,-17],[-8,-18],[-15,-13],[-23,-10],[-28,-4],
      [-29,5],[-25,10],[-16,11],[-11,17],[-1,16],
    ],1.65,true);
    path([[9,9],[6,9],[3,8]],1.25);
    path([[28,5],[27,2],[26,1.6]],1.25);
    path([[-23,-10],[-22,-11.5]],1.25);
    path([[-16,11],[-17,12.5]],1.25);
    latest.current.onLoadingProgress?.(30,'正在布置记忆展亭');
    await yieldToBrowser();if(stopped)return;
    // Glass memory pavilion: empty landscape panels are symbolic frames for the owner's stories.
    const pavilion=new THREE.Group();pavilion.position.set(-22,0,-16);world.add(pavilion);
    box(pavilion,edgeStone,10,.25,10,0,.08,0);box(pavilion,concrete,9.6,.16,9.6,0,.28,0);
    for(const x of[-4.3,4.3])for(const z of[-4.1,4.1])box(pavilion,dark,.12,4.5,.12,x,2.6,z);
    box(pavilion,glass,8.6,4.2,.03,0,2.55,-4.1);box(pavilion,glass,.03,4.2,8.2,-4.3,2.55,0);
    box(pavilion,glass,.03,4.2,8.2,4.3,2.55,0);box(pavilion,glass,8.9,.055,8.5,0,4.87,0);
    for(let i=0;i<6;i++)box(pavilion,dark,.055,.09,8.7,-4.45+i*1.78,4.9,0);
    for(const z of[-4.35,4.35])box(pavilion,dark,9,.09,.055,0,4.9,z);
    const frameColors=['#9aaa8e','#c1a77f','#799c99'];
    for(let i=0;i<3;i++){
      const x=(i-1)*2.7;box(pavilion,wood,2.06,2.5,.13,x,2.45,-2.8);box(pavilion,standard(frameColors[i]),1.82,2.26,.045,x,2.45,-2.71);
      // Geometric contours suggest a landscape without inventing any personal photographs.
      const contour=mesh(new THREE.CircleGeometry(.72,28,0,Math.PI),standard(i===1?'#a18b68':'#627f6b'),pavilion,x+.13,2.2,-2.67);contour.scale.y=.48;
      box(pavilion,brass,1.2,.045,.03,x,1.03,-2.69);box(pavilion,warmGlow,1.85,.035,.055,x,3.91,-2.63);
    }
    cylinder(pavilion,wood,.65,.1,0,.95,1.1,32);cylinder(pavilion,dark,.12,.55,0,.65,1.1,12);
    // The collectible case anchors the gallery beside the owner's memory frames.
    box(pavilion, dark, 2.35, .65, 1.45, 2.5, .69, 1.9);
    box(pavilion, brass, 2.45, .055, 1.55, 2.5, 1.04, 1.9);
    const collectible = createConceptCar('#8d3038').group;
    collectible.scale.setScalar(.29);
    collectible.position.set(2.5, 1.075, 1.9);
    collectible.rotation.y = Math.PI / 3;
    pavilion.add(collectible);
    box(pavilion, glass, 2.42, .035, 1.52, 2.5, 1.63, 1.9);
    for (const x of [1.3, 3.7]) box(pavilion, glass, .025, .57, 1.52, x, 1.34, 1.9);
    for (const z of [1.15, 2.65]) box(pavilion, glass, 2.42, .57, .025, 2.5, 1.34, z);
    box(pavilion,woodLight,2.1,.19,.55,-2.5,.73,2.3);for(const x of[-3.3,-1.7])box(pavilion,dark,.07,.4,.4,x,.46,2.3);
    glow(pavilion,0,4.1,-1.3,6);box(pavilion,stone,5,.12,1,0,.19,5.2);box(pavilion,stone,5.6,.1,1,0,.07,6.1);
    latest.current.onLoadingProgress?.(37,'正在布置露台');
    await yieldToBrowser();if(stopped)return;
    // A separate garden terrace is the social address: chairs, tea, cards and a mailbox.
    const terrace=new THREE.Group();terrace.position.set(-21,0,18);world.add(terrace);
    cylinder(terrace,edgeStone,8,.25,0,.06,0,64);cylinder(terrace,stone,7.75,.12,0,.24,0,64);
    box(terrace,woodLight,8.5,.14,6.3,-.6,.38,-.6);
    for(const x of[-4.6,3.4])for(const z of[-3.5,2.2])box(terrace,wood,.15,3.4,.15,x,2.1,z);
    for(let i=0;i<13;i++)box(terrace,wood,.13,.17,6.6,-4.8+i*.7,3.9,-.65);
    for(const z of[-3.65,2.35])box(terrace,wood,9.3,.17,.14,-.6,3.75,z);
    cylinder(terrace,concrete,1.35,.12,-.6,1.32,-.6,48);cylinder(terrace,dark,.15,.85,-.6,.84,-.6,16);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,x=-.6+Math.cos(a)*2.1,z=-.6+Math.sin(a)*2.1;
      cylinder(terrace,wood,.43,.12,x,.91,z,20);for(const dx of[-.25,.25])for(const dz of[-.22,.22])box(terrace,dark,.045,.46,.045,x+dx,.62,z+dz);
      const chairBack=box(terrace,woodLight,.82,.65,.09,x+Math.cos(a)*.33,1.28,z+Math.sin(a)*.33);chairBack.rotation.y=Math.PI/2-a;
    }
    cylinder(terrace,brass,.19,.27,-.65,1.52,-.6,24);sphere(terrace,leaf,.23,-.65,1.8,-.6,.9,1.1,.9);
    for(const[x,z]of[[-1.2,-.6],[.2,-.9],[-.6,.2]] as number[][]){cylinder(terrace,concrete,.11,.14,x,1.48,z,18);cylinder(terrace,stone,.17,.025,x,1.4,z,24);}
    const mailbox=new THREE.Group();mailbox.position.set(6.6,0,-2.4);terrace.add(mailbox);
    box(mailbox,wood,.13,1.25,.13,0,.9,0);box(mailbox,standard('#526b58'),.9,.63,.65,0,1.74,0);box(mailbox,brass,.55,.045,.03,0,1.82,.34);box(mailbox,stone,.37,.23,.025,.1,1.75,.36);
    const flag=box(mailbox,standard('#a86248'),.3,.15,.045,.52,2.04,0);flag.rotation.z=.15;
    box(terrace,wood,2.8,.16,.65,1.8,.83,5.6);for(const x of[.7,2.9])box(terrace,dark,.07,.5,.5,x,.5,5.6);
    glow(terrace,-.6,3.35,-.6,5);for(const x of[-3.6,2.4])box(terrace,warmGlow,.2,.15,.2,x,3.59,-.6);
    latest.current.onLoadingProgress?.(44,'正在布置庭院');
    await yieldToBrowser();if(stopped)return;
    for(const[x,z]of[[14,-4],[-13,-9],[-10,13],[-9,-25],[10,-24],[26,-17],[28,10],[9,25],[-13,27]] as number[][]){cylinder(world,dark,.045,1.45,x,.72,z,8);box(world,warmGlow,.22,.085,.22,x,1.48,z);}
    for(const[x,z,s]of[[-31,-21,1.3],[35,-16,1.5],[-30,28,1.3],[-10,-30,1.1]] as number[][]){sphere(world,edgeStone,1,x,.38,z,s,.55*s,s*.8);sphere(world,leaf,.7,x+1.2,.25,z+.5,1,.6,1);}
    box(island,edgeStone,24,.5,21,0,-.21,0);box(island,grass,23.8,.12,20.8,0,.07,0);
    // Crisp travertine edges, an inset pool, and staggered pavers.
    box(island,stone,10.3,.13,9.2,2.9,.16,3.2);
    box(island,concrete,4.3,.2,7.6,-5.65,.18,2.1);box(island,standard('#506e69'),3.7,.09,6.95,-5.65,.29,2.1);box(island,water,3.56,.03,6.82,-5.65,.35,2.1);
    for(let i=0;i<9;i++)box(island,standard('#9cbdb1'),3.43,.012,.025,-5.65,.372,-1.04+i*.78);
    for(let i=0;i<3;i++)box(island,stone,3.5,.1,.45,-5.65,.31,-.98+i*.5);
    const poolEdge=box(island,concrete,4.7,.16,.3,-5.65,.25,-1.85);poolEdge.castShadow=false;
    for(let i=0;i<10;i++) {const z=9.6-i*.83;const x=7.7-Math.sin(i*.32)*1.65;box(island,concrete,1.6,.10,.62,x,.18,z);}
    for(let i=0;i<7;i++)box(island,stone,1.13,.12,.7,-1.5-i*.84,.15,5.45+i*.2);
    for(let i=0;i<9;i++)box(island,concrete,.95,.07,.52,-6.8+i*1.08,.14,8.8);
    latest.current.onLoadingProgress?.(52,'正在准备家的建筑');
    await yieldToBrowser();if(stopped)return;
    function room(parent:THREE.Group,x:number,z:number,w:number,d:number,h=3.8,roofMaterial=concrete){
      box(parent,stone,w+.55,.3,d+.55,x,.37,z);
      box(parent,concrete,w,.18,d,x,h+.45,z);
      box(parent,roofMaterial,w+.6,.22,d+.5,x,h+.64,z);
      box(parent,woodLight,w,.15,d,x,.61,z);
      box(parent,concrete,w,h,.19,x,h/2+.56,z-d/2);
      box(parent,concrete,.19,h,d,x-w/2,h/2+.56,z);
      box(parent,glass,w-.25,h-.2,.025,x,h/2+.56,z+d/2-.08);
      box(parent,glass,.025,h-.2,d-.2,x+w/2-.08,h/2+.56,z);
      const divisions=Math.max(2,Math.round(w/1.5));for(let j=0;j<=divisions;j++)box(parent,dark,.045,h,.06,x-w/2+j*w/divisions,h/2+.56,z+d/2-.07);
      for(let j=0;j<=Math.round(d/1.5);j++)box(parent,dark,.06,h,.045,x+w/2-.07,h/2+.56,z-d/2+j*d/Math.round(d/1.5));
      box(parent,dark,w,.06,.055,x,.6,z+d/2-.065);box(parent,dark,w,.06,.055,x,h+.45,z+d/2-.065);
      box(parent,warmGlow,w-.4,.025,.055,x,h+.34,z+d/2-.25);glow(parent,x,h-.2,z,7);
      // The interiors remain legible through the large windows.
      const sofaMat=standard('#b9b2a0');box(parent,sofaMat,Math.min(w-1,2.8),.55,.9,x,.93,z-.55);box(parent,sofaMat,Math.min(w-1,2.8),.6,.22,x,1.26,z-.94);
      box(parent,wood,1.2,.12,.65,x,1,z+.75);for(const a of[-1,1])for(const b of[-1,1])box(parent,dark,.04,.43,.04,x+a*.49,.76,z+.75+b*.23);
      cylinder(parent,stone,.45,.06,x+.8,1.07,z+.65,24);cylinder(parent,brass,.07,.2,x+.8,1.2,z+.65);
    }
    function buildVilla(kind:HomeConfig['architecture']){
      const b=buildings[kind];if(b.children.length)return b;architecture.add(b);
      if(kind==='courtyard'){
        room(b,-3.8,-4,7.2,4.5);room(b,1.85,-5.1,4.1,6.7,3.8);
        box(b,wood,2.2,3.65,.24,-6.2,2.36,-1.65);for(let i=0;i<13;i++)box(b,woodLight,.045,3.58,.09,-7.2+i*.15,2.36,-1.49);
        box(b,concrete,1.6,.2,5.3,4.75,4.16,-4.3);box(b,concrete,.22,3.9,.22,5.35,2.18,-1.9);
        box(b,stone,3.8,.18,1.5,-2.4,.43,-1);box(b,stone,4.2,.15,.75,-2.4,.27,.1);
      } else if(kind==='pavilion'){
        room(b,-2.1,-4.8,11,5.7,3.5);box(b,wood,11.3,.24,1.2,-2.1,4.25,-1.5);
        for(let i=0;i<12;i++)box(b,woodLight,.14,.15,2.7,-7.3+i*.94,4.32,-.7);
        box(b,stone,11.5,.2,2,-2.1,.42,-.75);box(b,stone,12,.16,1,-2.1,.26,.65);
      }else{
        room(b,-3.4,-4.4,7.3,5.7,3.2,wood);
        const roof1=box(b,standard('#535a4b'),4.9,.25,6.65,-5.25,4.82,-4.4);roof1.rotation.z=.42;
        const roof2=box(b,standard('#535a4b'),4.9,.25,6.65,-1.55,4.82,-4.4);roof2.rotation.z=-.42;
        room(b,2.05,-5.3,3.4,4.4,2.6,wood);box(b,stone,8,.2,1.6,-3.4,.4,-.65);
        for(let i=0;i<18;i++)box(b,woodLight,.05,2.8,.08,-6.8+i*.39,2,-7.35);
      }
      // Chimney and a shaded entrance.
      box(b,edgeStone,.85,4.8,.9,-6.1,2.9,-6);box(b,wood,.9,1.9,.07,-3.4,1.6,-6.11);
      return b;
    }

    // Open carport doubles as the small private workshop.
    box(carport,stone,5.1,.14,6.3,0,.18,0);
    for(const x of[-2.35,2.35])for(const z of[-2.8,2.8])box(carport,dark,.12,3.2,.12,x,1.95,z);
    box(carport,wood,5.2,.18,6.4,0,3.64,0);box(carport,concrete,5.6,.14,6.8,0,3.81,0);
    for(let i=0;i<15;i++)box(carport,woodLight,5.0,.08,.09,0,3.49,-2.9+i*.41);
    for(const x of[-1.9,1.9])box(carport,warmGlow,.035,.018,5.8,x,3.47,0);
    glow(carport,0,3.13,0,9);
    const workbench=box(island,wood,2.1,.16,.8,6.6,1.15,-1.4);workbench.castShadow=true;
    for(const x of[5.7,7.5])box(island,dark,.07,.94,.07,x,.65,-1.4);
    box(island,dark,.75,.31,.38,6.7,1.4,-1.4);cylinder(island,brass,.09,.17,5.95,1.33,-1.3);
    const flowerMats=['#b5b48b','#e3ceb0','#a88b8a','#cbb98c'].map(c=>standard(c));
    for(let i=0;i<26;i++){
      const side=i<13?-1:1,x=side*(8.8+rand()*.7),z=-8.4+(i%13)*1.32;
      sphere(island,i%2?leaf:leafLight,.38+rand()*.28,x,.47,z,1,.65,1);
      if(i%3===0){for(let j=0;j<6;j++){const px=x+(rand()-.5)*.55,pz=z+(rand()-.5)*.55;cylinder(island,leaf,.015,.4,px,.4,pz,5);sphere(island,flowerMats[i%4],.08,px,.64+rand()*.1,pz);}}
    }
    for(const [x,z]of[[-7.8,7],[-2.5,6.5],[7.9,-5.8]] as number[][]){cylinder(island,standard('#ad8062'),.36,.65,x,.5,z,16);sphere(island,leaf,.58,x,1.03,z,1,.8,1);}
    // A quiet sitting place beside the water.
    const loungeMat=standard('#e2daca');
    for(const z of[.6,3.3]){
      box(island,wood,1.2,.1,2.05,-8,.53,z);const cushion=box(island,loungeMat,1.08,.17,1.87,-8,.65,z);cushion.rotation.x=-.05;
      const back=box(island,loungeMat,1.08,.15,.7,-8,.84,z-.65);back.rotation.x=-.45;
      for(const x of[-8.43,-7.57])for(const dz of[-.75,.75])box(island,wood,.06,.3,.06,x,.34,z+dz);
    }
    cylinder(island,concrete,.47,.5,-8,.45,5.3,32);cylinder(island,brass,.12,.13,-8,.78,5.3,20);
    for(const[x,z]of[[-3,7.8],[5.7,7.4],[8,-5],[-8,-3]] as number[][]){cylinder(island,dark,.055,1.1,x,.65,z,8);box(island,warmGlow,.22,.1,.22,x,1.22,z);glow(island,x,1.3,z,1.8);}
    // Small ground cover stones, clustered rather than noisy random decoration.
    const pebbleGeo=new THREE.IcosahedronGeometry(.12,0),pebbleMat=standard('#d0c8b4');
    const pebbles=new THREE.InstancedMesh(pebbleGeo,pebbleMat,140);const dummy=new THREE.Object3D();
    for(let i=0;i<140;i++){dummy.position.set(-10.1+rand()*1.3,.19,-9+rand()*18);dummy.scale.set(1+rand(),.5,1+rand());dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}island.add(pebbles);
    latest.current.onLoadingProgress?.(64,'正在准备车辆与环境');
    await yieldToBrowser();if(stopped)return;
    applyGardenConfig = (config:HomeConfig) => {
      if(!latest.current.campus?.startsWith('porsche-'))buildVilla(config.architecture);
      Object.entries(buildings).forEach(([key,b])=>b.visible=key===config.architecture);
    };
    applyGardenConfig(latest.current.config);
    worldDetails=addWorldDetails(world,island);
    worldDetails.setCampus(latest.current.campus);
    await mergeStaticMeshes(world,()=>stopped);
    await mergeStaticMeshes(island,()=>stopped);
    if(stopped)return;
    }
    await mergeStaticMeshes(workshop,()=>stopped);
    if(latest.current.view!=='workshop')await ensureLandscape();
    if(stopped)return;
    const vehicleStage=new THREE.Group();
    scene.add(vehicleStage);
    const studioColor=new THREE.Color('#f3f4f5');
    const car=createConceptCar(latest.current.config.carColor);car.group.position.set(3.12,.255,.25);car.group.rotation.y=-.06;vehicleStage.add(car.group);
    let researchParking = latest.current.campus === 'porsche-rd' ? createResearchParking(car.group, car.paint) : new THREE.Group();
    researchParking.visible = false;
    vehicleStage.add(researchParking);
    latest.current.onLoadingProgress?.(75,'正在准备庭院伙伴');
    await yieldToBrowser();if(stopped)return;
    const chickens = new THREE.Group();
    chickens.name = 'garden-chickens';
    island.add(chickens);
    const feathers = standard('#f4ead5'), comb = standard('#bd3930'), beak = standard('#db9b38');
    for (const [x,z,heading] of [[-4,5,.3],[-5.2,5.8,1.5],[-3.3,6.7,-.8],[-5.6,7.3,2.4],[-4.3,8.1,.7],[-2.5,8.4,-1.4],[-6.1,4.3,2.8]]) {
      const chicken = new THREE.Group();
      chicken.position.set(x,.25,z);
      chicken.rotation.y = heading;
      chickens.add(chicken);
      sphere(chicken,feathers,.32,0,.48,0,1,1.1,1.4);
      sphere(chicken,feathers,.19,0,.83,.31);
      sphere(chicken,comb,.1,0,1.01,.31,.6,1,1.5);
      sphere(chicken,comb,.07,0,.7,.46,.6,1.4,1);
      const bill = mesh(new THREE.ConeGeometry(.075,.19,4),beak,chicken,0,.82,.52);
      bill.rotation.x = Math.PI / 2;
      for (const side of [-1,1]) {
        sphere(chicken,dark,.025,side*.16,.87,.4);
        sphere(chicken,feathers,.21,side*.25,.49,-.04,.45,1,1.5);
        cylinder(chicken,beak,.025,.25,side*.12,.15,.02,6);
        box(chicken,beak,.09,.035,.18,side*.12,.035,.08);
      }
      const tail = sphere(chicken,feathers,.23,0,.65,-.39,.6,1.4,.65);
      tail.rotation.x = -.5;
    }
    const chickenOrigins = chickens.children.map(chicken => chicken.position.clone());
    let chickenTime = 0;
    function moveChickens(delta: number) {
      chickenTime += delta;
      chickens.children.forEach((chicken, index) => {
        const origin = chickenOrigins[index];
        const phase = index * 1.7;
        const angle = phase + chickenTime * (.3 + index * .025);
        chicken.position.set(
          origin.x + .55 * (Math.sin(angle) - Math.sin(phase)),
          origin.y + .025 * Math.abs(Math.sin(chickenTime * 7 + phase)),
          origin.z + .4 * (Math.cos(angle) - Math.cos(phase)),
        );
        chicken.rotation.y = Math.atan2(.55 * Math.cos(angle), -.4 * Math.sin(angle));
      });
    }
    const pets: Partial<Record<'cat'|'dog', ReturnType<typeof makeGardenPet>>> = {};
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    latest.current.onLoadingProgress?.(82,'正在准备灯光');
    let displayCar:DisplayCar|null=null;
    let partModules:PartModules|null=null;
    const guideMaterial = new THREE.LineDashedMaterial({ color: '#8e6260', dashSize: .09, gapSize: .07, transparent: true, opacity: .85, depthWrite: false });
    const guides: { part: DisplayCar['parts'][number]; line: THREE.Line; anchor: THREE.Vector3 }[] = [];
    cleanups.push(()=>guideMaterial.dispose());
    let readyPending=true,carLoadStarted=false,carLoadFailed=false;
    const mechanics: ReturnType<typeof createMechanicalAssembly> = { group: new THREE.Group(), parts: [] };
    const engineRoot=mechanics.group;engineRoot.position.copy(car.group.position);engineRoot.rotation.copy(car.group.rotation);engineRoot.visible=false;vehicleStage.add(engineRoot);
    const workshopExhibits = new Map<string, WorkshopExhibit>();
    let activeExhibit: WorkshopExhibit | undefined;
    let activeModelId: string | undefined;
    const pendingExhibits = new Map<string, Promise<WorkshopExhibit>>();
    const reportExhibit=(status:'loading'|'ready'|'error')=>{setExhibitState(status);latest.current.onExhibitStatus?.(status);};
    const cacheExhibit=(modelId:string,exhibit:WorkshopExhibit)=>{
      if(workshopExhibits.has(modelId))return;
      workshopExhibits.set(modelId,exhibit);exhibit.group.visible=false;vehicleStage.add(exhibit.group);
    };
    // Single code path for building a workshop exhibit: used when one is selected, and when
    // the garden prewarms the default model in the background (see prewarmWorkshop).
    const ensureExhibit=(modelId:string)=>{
      let pending=pendingExhibits.get(modelId);
      if(!pending){
        pending=(async () => {
          await yieldToBrowser();
          const create = workshopModels.find(model => model.id === modelId)?.create;
          if(!create)throw new Error(`no exhibit factory for ${modelId}`);
          const exhibit = await create(downloads.signal);
          try {
            if(!stopped)await prepare(exhibit.group);
            return exhibit;
          } catch(error) { disposeSceneObject(exhibit.group);throw error; }
        })();
        pendingExhibits.set(modelId, pending);
        // Cache as soon as it lands so a prewarmed model opens without a second wait.
        void pending.then(exhibit=>{
          if(stopped){disposeSceneObject(exhibit.group);return;}
          pendingExhibits.delete(modelId);
          cacheExhibit(modelId,exhibit);
        },()=>{pendingExhibits.delete(modelId);});
      }
      return pending;
    };
    let prewarmStarted=false;
    // Rolling rAF frame interval: how well the app is keeping up. Prewarm spends real main-thread
    // time (parse + shader compile), so it only runs when there is frame budget to spare — on a
    // device that is already struggling we keep the prefetched bytes and skip the CPU stage.
    let frameCostEma=16.7,prevFrameAt=0,frameSamples=0;
    const prewarmWorkshop=()=>{
      if(prewarmStarted||stopped)return;
      const model = workshopModels.find(({id}) => id === latest.current.workshopModelId) ?? workshopModels[0];
      if(!model?.create||workshopExhibits.has(model.id))return;
      prewarmStarted=true;
      const warm=()=>{
        if(stopped||workshopExhibits.has(model.id))return;
        // Judge the budget only on frames rendered after the world was ready — the tail of the
        // load itself is always slow and would otherwise always veto the prewarm. Waiting costs
        // nothing here: the bytes are already in hand, this only delays the parse + compile.
        if(frameSamples<8){setTimeout(warm,250);return;}
        if(frameCostEma>33){console.info('Workshop prewarm skipped: frame budget tight');return;}
        void ensureExhibit(model.id).catch(error=>{if(!stopped)console.warn('Workshop prewarm failed',error);});
      };
      const requestIdle=(globalThis as typeof globalThis & {requestIdleCallback?:(cb:()=>void,options?:{timeout:number})=>number}).requestIdleCallback;
      const afterBytes=()=>{ if(requestIdle)requestIdle(warm,{timeout:3000});else setTimeout(warm,1500); };
      // Bytes first (network only, no main-thread cost), then parse + shader compile while
      // the garden is idle — so walking into the workshop no longer stalls on a cold load.
      if(model.prefetch)void model.prefetch().then(afterBytes,afterBytes);else afterBytes();
    };
    let cameraFocus: THREE.Vector3 | null = null;
    let mechanicsLoading: Promise<void> | undefined;
    const ensureMechanics = () => mechanicsLoading ??= (async () => {
      const { createMechanicalAssembly } = await import('../lib/mechanical-assembly');
      await yieldToBrowser();if(stopped)return;
      const built = createMechanicalAssembly();
      try { if (!await prepare(built.group)) { disposeSceneObject(built.group);return; } }
      catch(error){disposeSceneObject(built.group);throw error;}
      mechanics.parts=built.parts;
      engineRoot.add(built.group);refresh();
    })().catch(error=>{mechanicsLoading=undefined;if(!stopped)console.warn('Mechanical detail unavailable',error);});


    async function loadMainCar() {
      await yieldToBrowser();if(stopped)return;
      // 主角车（庭院 / 欢迎镜头）= 911 GT3 RS：与车库展车同一台车模，车色与轮圈跟随配置面板。
      const { loadGt3RsDisplay } = await import('../lib/gt3-rs');
      if(stopped)return;
      const loaded = await loadGt3RsDisplay(latest.current.config.carColor);
      if(stopped){disposeSceneObject(loaded.group);return;}
      try { if(!await prepare(loaded.group)){disposeSceneObject(loaded.group);return;} }
      catch(error){disposeSceneObject(loaded.group);throw error;}

      displayCar=loaded;loaded.group.position.copy(car.group.position);loaded.group.rotation.copy(car.group.rotation);vehicleStage.add(loaded.group);car.group.visible=false;
      vehicleStage.remove(researchParking);
      disposeResearchParking(researchParking);
      researchParking = latest.current.campus === 'porsche-rd' ? createResearchParking(loaded.group, loaded.paint) : new THREE.Group();
      researchParking.visible = latest.current.campus === 'porsche-rd';
      vehicleStage.add(researchParking);
      for (const part of loaded.parts) {
        const anchor = new THREE.Box3().setFromObject(part.group).getCenter(new THREE.Vector3());
        loaded.group.worldToLocal(anchor);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([anchor, anchor]), guideMaterial);
        line.geometry.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(2), 1));
        line.visible = false;
        line.frustumCulled = false;
        loaded.group.add(line);
        guides.push({ part, line, anchor });
      }

      loaded.paint.color.set(latest.current.config.carColor);loaded.rims.forEach(m=>m.color.set(latest.current.config.wheels==='black'?'#353a36':'#c0c5c3'));
      container.dataset.carModel='gt3-rs';
      refresh();
    }
    // Rain and stars remain light enough for a laptop browser.
    const rainCount=1000,rainPositions=new Float32Array(rainCount*6);
    for(let i=0;i<rainCount;i++){const x=(rand()-.5)*88,y=rand()*17,z=(rand()-.5)*76;rainPositions.set([x,y,z,x-.05,y-.38,z+.02],i*6);}
    const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
    const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#c8d7cf',transparent:true,opacity:.38}));scene.add(rain);
    const starsPositions=new Float32Array(230*3);for(let i=0;i<230;i++)starsPositions.set([(rand()-.5)*140,20+rand()*65,-30-rand()*65],i*3);
    const starsGeometry=new THREE.BufferGeometry();starsGeometry.setAttribute('position',new THREE.BufferAttribute(starsPositions,3));
    const stars=new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:'#e8e8d1',size:.11,transparent:true,opacity:.8}));scene.add(stars);
    let currentView=latest.current.view,desiredExplode=latest.current.explode,actualExplode=desiredExplode,transition=true,entranceStarted=false,gateOpen=0;
    const desiredCamera=new THREE.Vector3(),desiredTarget=new THREE.Vector3();
    const sunTarget=new THREE.Color(),fogTarget=new THREE.Color();let ambientTarget=1.15,sunIntensity=3.35,exposureTarget=1.02;
    function setView(v:Props['view']){
      refresh();
      cameraFocus=null;
      currentView=v;transition=true;const narrow=container.clientWidth<650,aspect=container.clientWidth/Math.max(container.clientHeight,1);
      const studio=v==='workshop';
      if(!studio&&!landscapeReady&&!landscapeLoading){
        latest.current.onLoadingProgress?.(8,'正在准备庭院');
        void ensureLandscape().then(async()=>{
          if(stopped)return;
          setConfig(latest.current.config);
          if(!await prepare(scene))return;
          landscapeReady=true;readyPending=true;
        }).catch(error=>{if(!stopped){console.warn('Landscape unavailable',error);setFailed(true);latest.current.onReady?.();}});
      }
      terrain.visible=island.visible=!studio;world.visible=true;

      camera.clearViewOffset();
      if(studio)camera.setViewOffset(container.clientWidth||1,container.clientHeight||1,0,(container.clientHeight||1)*(narrow?.22:.12),container.clientWidth||1,container.clientHeight||1);
      camera.fov=v==='entry'?(narrow?54:42):(v==='map'||v==='home')?42:38;camera.updateProjectionMatrix();
      controls.maxDistance=350;controls.minDistance=v==='map'?30:5;
      if(v==='entry'){
        if(entranceStarted){desiredCamera.set(narrow?8:10.5,3.35,narrow?55:43);desiredTarget.set(4.5,1.9,25);}
        else{desiredCamera.set(narrow?10:12,3.5,narrow?63:50);desiredTarget.set(5,2,29);}
        controls.minDistance=7;controls.maxDistance=70;
      }else if(v==='map'||(v==='home'&&!latest.current.campus?.startsWith('porsche-'))){
        const fit=Math.max(1,.98/aspect);desiredCamera.set(66*fit,58*fit,86*fit);desiredTarget.set(0,1,-4);
      }else if(v==='workshop'){
        const fit=Math.max(1,.9/aspect);
        desiredCamera.set(26+7.1*fit,5.9*fit,-4+9.1*fit);
        desiredTarget.set(26,1.45,-4);
      }else if(v==='memories'){
        desiredCamera.set(narrow?-8:-11,narrow?10:8,narrow?5:-2);desiredTarget.set(-22,1.55,-16);
      }else if(v==='terrace'){
        desiredCamera.set(narrow?-6:-9,narrow?12:9,narrow?38:33);desiredTarget.set(-21,1.3,18);
      }else if(latest.current.campus?.startsWith('porsche-')){
        const fit=Math.max(1,.95/aspect);
        desiredCamera.set(25*fit,20*fit,31*fit);
        desiredTarget.set(-1,4,-3);
        controls.minDistance=10;
      }else{
        desiredCamera.set(narrow?27:21,narrow?23:16,narrow?34:25);desiredTarget.set(0,1.1,0);controls.minDistance=14;
      }
      if(scene.fog instanceof THREE.Fog){scene.fog.near=v==='map'?230:52;scene.fog.far=v==='map'?470:175;}
      car.group.position.set(v==='workshop'?26:3.12,v==='workshop'?.49:.255,v==='workshop'?-3.95:.25);
      displayCar?.group.position.copy(car.group.position);engineRoot.position.copy(car.group.position);
      if(reducedMotion){camera.position.copy(desiredCamera);controls.target.copy(desiredTarget);transition=false;}
    }
    function setConfig(c:HomeConfig){
      refresh();
      applyGardenConfig?.(c);
      car.paint.color.set(c.carColor);car.rims.color.set(c.wheels==='black'?'#353a36':'#c0c5c3');
      if(displayCar){displayCar.paint.color.set(c.carColor);displayCar.rims.forEach(m=>m.color.set(c.wheels==='black'?'#353a36':'#c0c5c3'));}
      const night=c.time==='night',day=c.time==='day',wet=c.weather==='rain';
      sunTarget.set(night?'#b7c8e0':day?'#fff7e5':'#ffe4ae');fogTarget.set(night?'#25382f':wet?'#8e9f98':day?'#c6d4c3':'#c1c5b7');
      ambientTarget=night?.45:wet?1.3:day?1.55:1.15;sunIntensity=night?.45:wet?1.7:day?3.3:3.35;exposureTarget=night?.94:day?1.08:1.02;
      scene.environmentIntensity=night?.2:day?.5:.42;
      sunlight.position.set(day?-10:-16,day?26:night?18:16,day?7:10);
      rain.visible=wet;stars.visible=night&&!wet;allFixtures.forEach(l=>l.intensity=night?9:day?.3:4);warmGlow.emissiveIntensity=night?2:day?.15:.8;
      stone.roughness=wet?.48:.85;concrete.roughness=wet?.54:.85;
    }
    runtime.current={refresh,retryExhibit:()=>{activeModelId=undefined;refresh();},setConfig,setView,setExplode:n=>{desiredExplode=THREE.MathUtils.clamp(n,0,1);refresh();}};
    setConfig(latest.current.config);setView(latest.current.view);
    camera.position.copy(desiredCamera);controls.target.copy(desiredTarget);transition=false;
    const resize=()=>{const width=container.clientWidth||1,height=container.clientHeight||1;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();setView(currentView);};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    cleanups.push(()=>observer.disconnect());
    let pointerStart={x:0,y:0};const down=(event:PointerEvent)=>{pointerStart={x:event.clientX,y:event.clientY};transition=false;};
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const up=(event:PointerEvent)=>{if(currentView!=='workshop'||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>6)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const roots=activeExhibit?[activeExhibit.group]:displayCar?[displayCar.group,...(engineRoot.visible?[engineRoot]:[])]:[car.group];const hits=raycaster.intersectObjects(roots,true);if(hits.length){let node:THREE.Object3D|null=hits[0].object;while(node&&!node.userData.part)node=node.parent;if(node?.userData.part)latest.current.onPartSelect?.(node.userData.part);}};
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
    cleanups.push(()=>{renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);});
    let lastTime=0,hasDrawnFrame=false,lastAssemblyProgress=NaN;
    let exhibitReadyPending=false;
    latest.current.onLoadingProgress?.(92,'正在预热场景');
    if(!await prepare(scene))return;
    landscapeReady=!!landscapeLoading;

    const render=(time:number)=>{
      if(stopped)return;frame=requestAnimationFrame(render);const delta=Math.min((time-lastTime)/1000,.05)||.016;lastTime=time;
      if(prevFrameAt)frameCostEma=frameCostEma*.8+(time-prevFrameAt)*.2;frameSamples++;prevFrameAt=time;
      if(document.hidden||(!latest.current.active&&hasDrawnFrame&&!readyPending&&!exhibitReadyPending))return;
      if(currentView!=='workshop'&&!landscapeReady)return;
      controls.update();
      // Keep damping responsive, but skip settled garage animation and scene traversal work.
      if(currentView==='workshop' && latest.current.workshopModelId===activeModelId &&
        !dirty && !transition && !readyPending && !exhibitReadyPending &&
        Math.abs(actualExplode-desiredExplode)<=.001 && time>=redrawUntil)return;
      if (latest.current.active && currentView!=='workshop' && !reducedMotion) moveChickens(delta);
      for (const kind of ['cat', 'dog'] as const) {
        if(latest.current.pet===kind&&!pets[kind]){pets[kind]=makeGardenPet(kind);island.add(pets[kind]!.group);}
        const animal = pets[kind];
        if(!animal)continue;
        animal.group.visible = latest.current.pet === kind;
        if (animal.group.visible && !reducedMotion) animal.tail.rotation.y = Math.sin(time * .004) * .42;
      }
      if(latest.current.active){
        if (latest.current.campus !== 'porsche-rd') { gateOpen=reducedMotion?1:THREE.MathUtils.lerp(gateOpen,1,1-Math.exp(-delta*1.4));worldDetails?.setGateOpen(gateOpen); }
        if(currentView==='entry'&&!entranceStarted){entranceStarted=true;setView('entry');if(matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.copy(desiredCamera);controls.target.copy(desiredTarget);gateOpen=1;worldDetails?.setGateOpen(1);transition=false;}}
      }
      if(transition){camera.position.lerp(desiredCamera,1-Math.exp(-delta*3.2));controls.target.lerp(desiredTarget,1-Math.exp(-delta*3.2));if(camera.position.distanceTo(desiredCamera)<.025)transition=false;}
      world.visible = latest.current.campus !== 'porsche-rd';
      architecture.visible = !latest.current.campus?.startsWith('porsche-');
      carport.visible = architecture.visible;
      const studio = currentView === 'workshop';
      const selectedModel = studio ? latest.current.workshopModelId : undefined;
      if (studio && selectedModel === 'carrera-4s' && !mechanicsLoading)void ensureMechanics();
      if (selectedModel !== activeModelId) {
        refresh();
        exhibitReadyPending=false;lastAssemblyProgress=NaN;
        if (activeExhibit) activeExhibit.group.visible = false;
        activeModelId = selectedModel;
        activeExhibit = selectedModel ? workshopExhibits.get(selectedModel) : undefined;
        const create = workshopModels.find(model => model.id === selectedModel)?.create;
        if (selectedModel && create && !activeExhibit) {
          reportExhibit('loading');
          ensureExhibit(selectedModel).then(exhibit => {
            if (stopped || activeModelId !== selectedModel) return;
            activeExhibit = exhibit;
            exhibit.group.visible = true;
            actualExplode = latest.current.explode;
            exhibitReadyPending=true;
          }).catch(error => {
            if (stopped || activeModelId !== selectedModel) return;
            console.warn('Workshop model unavailable', error);
            reportExhibit('error');
          });
        } else {
          if (activeExhibit) activeExhibit.group.visible = true;
          reportExhibit('ready');
        }
        actualExplode = latest.current.explode;
      }
      if (activeExhibit) {
        activeExhibit.group.position.copy(car.group.position);
        activeExhibit.group.rotation.copy(car.group.rotation);
        activeExhibit.syncOwned?.(latest.current.ownedParts ?? [], delta);
        if(desiredExplode!==lastAssemblyProgress){activeExhibit.assemble?.(desiredExplode);lastAssemblyProgress=desiredExplode;}
      }
      const focus = activeExhibit?.focus?.(desiredExplode);
      if (focus && focus.target !== cameraFocus) {
        cameraFocus = focus.target;
        controls.minDistance = 1.15;
        desiredTarget.copy(focus.target).applyEuler(car.group.rotation).add(car.group.position);
        const fit = Math.max(1, .95 / camera.aspect);
        desiredCamera.copy(desiredTarget).addScaledVector(focus.cameraOffset, fit);
        transition = true;
      } else if (!focus && cameraFocus) {
        cameraFocus = null;
        setView(currentView);
      }
      // 庭院 / 欢迎镜头始终摆主角车；车库视图里，选中的展车自带装配工厂时就让位给展车。
      const useMainCar = !studio || !workshopModels.some(model => model.id === selectedModel && model.create);
      const research = latest.current.campus === 'porsche-rd';
      researchParking.visible = research && (!!displayCar || carLoadFailed);
      chickens.visible = !research;
      car.group.visible = useMainCar && carLoadFailed && !displayCar && !research;
      if (displayCar) displayCar.group.visible = useMainCar && !research;
      actualExplode=THREE.MathUtils.lerp(actualExplode,desiredExplode,1-Math.exp(-delta*7));
      const partProgress=(part:DisplayCar['parts'][number])=>{
        const name=part.group.userData.part;
        if (useMainCar && studio) {
          const start = name === 'powertrain' || name === 'chassis' ? 0 : name === 'wheels' ? .3 : name === 'body' ? .6 : .85;
          const end = name === 'powertrain' || name === 'chassis' ? .3 : name === 'wheels' ? .6 : name === 'body' ? .86 : 1;
          return 1 - THREE.MathUtils.smoothstep(actualExplode, start, end);
        }
        if (!studio) return 0;
        const start=part.group.userData.phase ?? (name==='body'?0:name==='glass'?.13:name==='wheels'?.24:name==='powertrain'?.37:.25);
        return THREE.MathUtils.smoothstep(actualExplode,start,Math.min(1,start+.45));
      };
      for(const part of activeExhibit?.parts ?? [...car.parts,...mechanics.parts,...(displayCar?.parts??[])]){
        part.group.position.copy(part.origin).addScaledVector(part.offset,partProgress(part));
      }
      engineRoot.visible=useMainCar&&!!displayCar&&studio&&actualExplode<.86;
      if (studio && useMainCar && displayCar && !partModules) {
        partModules = createPartModules(displayCar);
        partModules.sync(latest.current.ownedParts ?? [], 0);
      }
      if (partModules) {
        partModules.group.visible = studio && useMainCar;
        if (partModules.group.visible) partModules.sync(latest.current.ownedParts ?? [], delta);
      }
      for (const { part, line, anchor } of guides) {
        const progress=partProgress(part);
        line.visible = studio && progress > .025 && part.offset.lengthSq() > .1;
        if (!line.visible) continue;
        const shift = part.offset;
        const position = line.geometry.getAttribute('position');
        position.setXYZ(1, anchor.x + shift.x * progress, anchor.y + shift.y * progress, anchor.z + shift.z * progress);
        position.needsUpdate = true;
        const distance = line.geometry.getAttribute('lineDistance');
        distance.setX(1, shift.length() * progress);
        distance.needsUpdate = true;
      }
      if(scene.background instanceof THREE.Color)scene.background.lerp(fogTarget,.08);if(scene.fog instanceof THREE.Fog)scene.fog.color.copy(scene.background as THREE.Color);
      sunlight.color.lerp(studio?studioColor:sunTarget,.025);sunlight.intensity=THREE.MathUtils.lerp(sunlight.intensity,studio?3:sunIntensity,.025);ambient.intensity=THREE.MathUtils.lerp(ambient.intensity,studio?1.7:ambientTarget,.025);renderer.toneMappingExposure=THREE.MathUtils.lerp(renderer.toneMappingExposure,studio?1.12:exposureTarget,.025);
      rain.visible=!studio&&latest.current.config.weather==='rain';
      stars.visible=!studio&&latest.current.config.time==='night'&&!rain.visible;
      scene.environmentIntensity=studio?.9:latest.current.config.time==='night'?.2:latest.current.config.time==='day'?.5:.42;
      if(rain.visible){const points=rainGeometry.attributes.position.array as Float32Array;for(let i=0;i<rainCount;i++){points[i*6+1]-=delta*9;points[i*6+4]-=delta*9;if(points[i*6+1]<0){points[i*6+1]+=17;points[i*6+4]+=17;}}rainGeometry.attributes.position.needsUpdate=true;}
      const animated = transition || rain.visible || (!reducedMotion && !studio && !research) ||
        (!studio && !research && gateOpen < .999) || Math.abs(actualExplode-desiredExplode)>.001 || time<redrawUntil;
      if(!dirty&&!animated&&!readyPending&&!exhibitReadyPending)return;
      renderer.render(scene,camera);dirty=false;
      hasDrawnFrame=true;
      if(exhibitReadyPending){exhibitReadyPending=false;reportExhibit('ready');}
      if(readyPending && (!useMainCar || displayCar || carLoadFailed)){readyPending=false;latest.current.onLoadingProgress?.(100,'欢迎回家。');latest.current.onReady?.();frameCostEma=16.7;frameSamples=0;prevFrameAt=0;prewarmWorkshop();}
      if(!carLoadStarted && useMainCar){
        carLoadStarted=true;
        if(readyPending)latest.current.onLoadingProgress?.(96,'正在准备 911');
        void loadMainCar().catch(error=>{if(!stopped){console.warn('911 model unavailable',error);carLoadFailed=true;container.dataset.carModel='concept-fallback';refresh();}});
      }
      const placed:{x:number;y:number;width:number;height:number}[]=[];
      DESTINATIONS.forEach(place=>{
        const button=hotspots.current[place.id];if(!button)return;
        if(currentView!=='map'&&currentView!=='home'){button.style.visibility='hidden';return;}
        const projected=new THREE.Vector3(...place.position).project(camera);
        if(projected.z>1||projected.z<0||Math.abs(projected.x)>1.15||Math.abs(projected.y)>1.15){button.style.visibility='hidden';return;}
        const width=container.clientWidth,height=container.clientHeight,bw=button.offsetWidth||116,bh=button.offsetHeight||52;
        const x=THREE.MathUtils.clamp((projected.x*.5+.5)*width,bw/2+8,width-bw/2-8);let y=THREE.MathUtils.clamp((-projected.y*.5+.5)*height,125,height-145);
        for(let pass=0;pass<5;pass++){
          const collision=placed.find(p=>Math.abs(p.x-x)<(p.width+bw)/2+5&&Math.abs(p.y-y)<(p.height+bh)/2+5);
          if(!collision)break;y=Math.min(height-145,collision.y+(collision.height+bh)/2+9);
        }
        placed.push({x,y,width:bw,height:bh});button.style.visibility='visible';button.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;
      });
    };
    frame=requestAnimationFrame(render);
    }
    void initialize().catch(error=>{
      if(stopped)return;
      console.warn('Scene initialization failed',error);
      cleanup();setFailed(true);latest.current.onReady?.();
    });
    return cleanup;
  },[attempt]);
  useEffect(()=>{runtime.current?.refresh();},[active,pet,ownedParts]);
  useEffect(()=>{runtime.current?.setConfig(config);},[config]);
  useEffect(()=>{runtime.current?.setView(view);},[view]);
  useEffect(()=>{runtime.current?.setExplode(explode);},[explode]);
  const exhibitName = view === 'workshop'
    ? workshopModels.find(model => model.id === workshopModelId)?.name
    : undefined;
  return <div ref={host} className="garden-canvas" style={{width:'100%',height:'100%',position:'relative'}} aria-label={exhibitName ? `车库展车 ${exhibitName}，可拖动旋转与缩放` : "可拖动、缩放和平移探索的保时捷之家地图"}>
    {view==='workshop'&&exhibitState!=='ready'&&<div role="status" style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',padding:'12px 18px',background:'rgba(248,246,236,.94)',borderRadius:8,zIndex:6}}>{exhibitState==='loading'?'正在准备车型…':<>车型暂时未能载入。<button onClick={()=>runtime.current?.retryExhibit()}>重新加载</button></>}</div>}
    {failed && <div role="alert" className="private-garage-status">场景暂时未能载入。<button onClick={()=>{setFailed(false);setAttempt(value=>value+1);}}>重新加载</button></div>}
    {DESTINATIONS.filter(place => campus !== 'porsche-rd' || place.id === 'home').map(place=><button key={place.id} ref={node=>{hotspots.current[place.id]=node;}} type="button" className="world-hotspot" aria-label={`进入${place.name}`} onClick={()=>latest.current.onPlaceSelect?.(place.id)} style={{position:'absolute',zIndex:5,top:0,left:0,visibility:'hidden',pointerEvents:'auto',cursor:'pointer',border:'1px solid rgba(255,255,255,.7)',background:'rgba(248,246,236,.94)',color:'#354b38',borderRadius:14,padding:'11px 15px',boxShadow:'0 7px 25px rgba(37,50,31,.15)',fontFamily:'inherit',backdropFilter:'blur(10px)',whiteSpace:'nowrap',textAlign:'left'}}>
      <span style={{display:'block',fontSize:13,fontWeight:600,letterSpacing:'.035em'}}><span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:'#7e9567',marginRight:7,verticalAlign:'middle'}}/>{place.name}<span aria-hidden="true" style={{marginLeft:8,fontSize:12,opacity:.5}}>↗</span></span>
      <span style={{display:'block',marginTop:4,fontSize:8,letterSpacing:'.13em',opacity:.58}}>{place.subtitle}</span>
    </button>)}
  </div>;
}
