import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { yieldToBrowser } from './scene-loading';
import type { CarPart } from './car-geometry';

export type DisplayCar = {
  group:THREE.Group; parts:CarPart[];
  paint:THREE.MeshPhysicalMaterial; rims:THREE.MeshStandardMaterial[];
};

function splitSide(source:THREE.BufferGeometry,side:number) {
  const geometry=source.index?source.toNonIndexed():source.clone();
  const position=geometry.getAttribute('position');const triangles:number[]=[];
  for(let i=0;i<position.count;i+=3)if((position.getX(i)+position.getX(i+1)+position.getX(i+2))*side>0)triangles.push(i,i+1,i+2);
  const result=new THREE.BufferGeometry();
  for(const[name,attribute]of Object.entries(geometry.attributes)){
    const values=new Float32Array(triangles.length*attribute.itemSize);
    triangles.forEach((index,i)=>{for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=c===0?attribute.getX(index):c===1?attribute.getY(index):c===2?attribute.getZ(index):attribute.getW(index);});
    result.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize));
  }
  geometry.dispose();result.computeBoundingBox();result.computeBoundingSphere();return result;
}

/** Runtime assembly of the attributed CC BY-SA model; the source GLB is kept unchanged. */
export async function loadDisplayCar(color:string,onProgress?:(fraction:number)=>void):Promise<DisplayCar> {
  // The decoder resolves browser asset URLs when its module is loaded.
  const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
  const draco=new DRACOLoader();draco.setDecoderPath('./models/draco/');
  const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  let gltf;
  try{gltf=await loader.loadAsync('./models/porsche-911-carrera-4s.glb',event=>{if(event.total>0)onProgress?.(event.loaded/event.total);});}finally{draco.dispose();}
  const source=gltf.scene;const plane=source.getObjectByName('Plane');plane?.removeFromParent();source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const normalization=new THREE.Matrix4().makeScale(4.75/size.z,4.75/size.z,4.75/size.z);
  const translation=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
  normalization.multiply(translation);
  const group=new THREE.Group(),parts:CarPart[]=[],rims:THREE.MeshStandardMaterial[]=[];
  const paint=new THREE.MeshPhysicalMaterial({color,metalness:.64,roughness:.24,clearcoat:1,clearcoatRoughness:.1,side:THREE.DoubleSide});
  const buckets=new Map<string,THREE.Group>();
  function bucket(key:string,delta:THREE.Vector3){let b=buckets.get(key);if(!b){b=new THREE.Group();b.userData.part=key.split(':')[0];group.add(b);parts.push({group:b,origin:new THREE.Vector3(),offset:delta});buckets.set(key,b);}return b;}
  const meshes: THREE.Mesh[] = [];
  source.traverse(node=>{if(node instanceof THREE.Mesh)meshes.push(node);});
  for(const node of meshes){
    await yieldToBrowser();
    const original=node.material as THREE.MeshStandardMaterial;
    const baked=node.geometry.clone().applyMatrix4(node.matrixWorld).applyMatrix4(normalization);
    const ancestor=node.parent?.name??node.name;const name=ancestor.toLowerCase();
    const wheel=name.includes('cylinder');
    const material:THREE.MeshStandardMaterial=original.name==='paint'||original.name==='coat'?paint:original.clone();
    if(original.name==='rubber'){material.metalness=0;material.roughness=.88;}
    else if(original.name==='full_black'){material.metalness=.02;material.roughness=.64;}
    if(wheel&&original.name==='silver'){material.metalness=.85;material.roughness=.24;rims.push(material);}
    const add=(geometry:THREE.BufferGeometry,parent:THREE.Group)=>{const display=new THREE.Mesh(geometry,material);display.castShadow=true;display.receiveShadow=true;parent.add(display);};
    if(wheel){
      for(const side of[-1,1])add(splitSide(baked,side),bucket(`wheels:${name}:${side}`,new THREE.Vector3(side*1.35,.12,name.includes('001')?.34:-.34)));
      baked.dispose();
    }else if(original.name==='window'||name.includes('window')||name.includes('windshield'))add(baked,bucket('glass',new THREE.Vector3(0,2.5,-.1)));
    else if(name.startsWith('bumper_front'))add(baked,bucket('body:front',new THREE.Vector3(0,.6,1.45)));
    else if(original.name==='paint'||original.name==='coat'||['license','logo','tex_shiny','lights','glass'].includes(original.name))add(baked,bucket('body',new THREE.Vector3(0,1.65,0)));
    else add(baked,bucket('chassis',new THREE.Vector3(0,.12,0)));
  }
  // Cloned materials retain the GLB's texture objects; geometries and the source material shells can be released.
  source.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry.dispose();const mats=Array.isArray(node.material)?node.material:[node.material];mats.forEach(m=>m.dispose());}});
  return{group,parts,paint,rims};
}
