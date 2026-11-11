import * as THREE from 'three';

type Section = [number, number, number, number];
export type CarPart = { group: THREE.Group; origin: THREE.Vector3; offset: THREE.Vector3 };
export type ConceptCar = { group: THREE.Group; parts: CarPart[]; paint: THREE.MeshPhysicalMaterial; rims: THREE.MeshStandardMaterial };

// Sweeps an elliptical cross-section along z; shared with the hard-surface vehicle module.
export function loft(sections: Section[], segments = 40) {
  const vertices: number[] = [], indices: number[] = [];
  sections.forEach(([z, width, top, bottom]) => {
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      vertices.push(Math.sin(a) * width, (top + bottom) / 2 + Math.cos(a) * (top - bottom) / 2, z);
    }
  });
  for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const first = vertices.length / 3; vertices.push(0, (sections[0][2] + sections[0][3]) / 2, sections[0][0]);
  const last = vertices.length / 3; const tail = sections[sections.length - 1]; vertices.push(0, (tail[2] + tail[3]) / 2, tail[0]);
  for (let i = 0; i < segments; i++) { indices.push(first, i + 1, i); const a = (sections.length - 1) * (segments + 1) + i; indices.push(last, a, a + 1); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createConceptCar(color: string, style: 'coupe' | 'roadster' = 'coupe'): ConceptCar {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({color, metalness: .57, roughness: .24, clearcoat: 1, clearcoatRoughness: .17});
  const glass = new THREE.MeshPhysicalMaterial({color: '#253c3e', metalness: .22, roughness: .12, clearcoat: 1, transparent: true, opacity: .82});
  const black = new THREE.MeshStandardMaterial({color: '#171a19', roughness: .48});
  const tire = new THREE.MeshStandardMaterial({color: '#1d211f', roughness: .86});
  const rims = new THREE.MeshStandardMaterial({color: '#b4b9b8', metalness: .88, roughness: .24});
  const brake = new THREE.MeshStandardMaterial({color: '#737a78', metalness: .8, roughness: .48});
  const warm = new THREE.MeshStandardMaterial({color: '#976a48', roughness: .8});
  const red = new THREE.MeshStandardMaterial({color: '#bd291f', emissive: '#ff3726', emissiveIntensity: 1.1, roughness: .2});
  const light = new THREE.MeshStandardMaterial({color: '#fff9de', emissive: '#fff2ca', emissiveIntensity: 1.9});
  const parts: CarPart[] = [];
  function part(key: string, offset: THREE.Vector3) {
    const p = new THREE.Group(); p.userData.part = key; group.add(p); parts.push({group: p, origin: p.position.clone(), offset}); return p;
  }
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x=0,y=0,z=0) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(parent: THREE.Object3D, material: THREE.Material, w:number,h:number,d:number,x=0,y=0,z=0) { return mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z); }
  function rod(parent: THREE.Object3D, material: THREE.Material, a:THREE.Vector3,b:THREE.Vector3,r=.023) {
    const delta = b.clone().sub(a); const m = mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material,parent); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return m;
  }
  const chassis = part('chassis',new THREE.Vector3(0,.18,0));
  box(chassis,black,1.54,.16,3.78,0,.28,0);
  box(chassis,brake,1.25,.1,1.7,0,.39,.2);
  for (const x of [-.37,.37]) {
    const seat = box(chassis,warm,.46,.42,.48,x,.71,-.1); seat.rotation.x=-.11;
    const back = box(chassis,warm,.45,.55,.14,x,.96,-.4); back.rotation.x=-.16;
    box(chassis,warm,.31,.19,.12,x,1.27,-.45);
  }
  box(chassis,black,1.2,.24,.3,0,.86,.7);
  const steering = mesh(new THREE.TorusGeometry(.16,.024,8,28),black,chassis,-.36,1.01,.6); steering.rotation.x=-.35;
  for (const z of [-1.35,1.33]) { const axle = mesh(new THREE.CylinderGeometry(.045,.045,1.92,8),brake,chassis,0,.44,z); axle.rotation.z=Math.PI/2; }
  const shell = part('body',new THREE.Vector3(0,1.65,0));
  mesh(loft([[-2.19,.45,.67,.41],[-2.05,.74,.78,.3],[-1.65,.93,.84,.24],[-1.2,.98,.9,.24],[-.5,.91,.87,.23],[.4,.88,.79,.23],[1.15,.94,.74,.25],[1.7,.88,.69,.29],[2.08,.67,.59,.35],[2.24,.28,.49,.4]]),paint,shell);
  // The narrow roof, long rear window, and low rounded front are deliberately a 911-inspired silhouette.
  const cabin = part('glass',new THREE.Vector3(0,2.75,-.12));
  if (style === 'coupe') mesh(loft([[-1.37,.55,.86,.76],[-1.05,.68,1.13,.77],[-.64,.7,1.38,.78],[-.16,.68,1.43,.78],[.28,.64,1.35,.76],[.66,.56,1.1,.74],[1.04,.4,.76,.7]],32),glass,cabin);
  if (style === 'coupe') {
    const roof = mesh(loft([[-.79,.47,1.37,1.32],[-.56,.51,1.44,1.39],[-.14,.5,1.48,1.43],[.22,.46,1.4,1.35]],24),paint,shell);
    roof.userData.part = 'body';
  } else {
    mesh(loft([[.38,.63,1.24,.78],[.5,.61,1.19,.76],[.96,.46,.79,.72]],24),glass,cabin);
    rod(shell,black,new THREE.Vector3(-.63,1.24,.38),new THREE.Vector3(.63,1.24,.38),.035);
    for (const x of [-.37,.37]) {
      const hoop=mesh(new THREE.TorusGeometry(.19,.035,8,24,Math.PI),rims,shell,x,1.13,-.52);
      hoop.rotation.y=Math.PI;
    }
  }
  for (const sign of [-1,1]) {
    if (style === 'coupe') {
      rod(shell,paint,new THREE.Vector3(sign*.45,1.38,.21),new THREE.Vector3(sign*.62,.78,1.02),.032);
      rod(shell,paint,new THREE.Vector3(sign*.49,1.36,-.77),new THREE.Vector3(sign*.68,.8,-1.36),.047);
      rod(shell,paint,new THREE.Vector3(sign*.69,.83,-1.25),new THREE.Vector3(sign*.65,.79,.92),.027);
      rod(shell,paint,new THREE.Vector3(sign*.68,.82,-.17),new THREE.Vector3(sign*.66,1.38,-.17),.026);
    }
    const mirror = mesh(new THREE.SphereGeometry(1,16,12),paint,shell,sign*.94,.93,.65); mirror.scale.set(.17,.075,.11);
    rod(shell,black,new THREE.Vector3(sign*.76,.86,.62),new THREE.Vector3(sign*.9,.92,.65),.025);
    box(shell,black,.028,.034,.25,sign*.904,.75,-.35);
    // Soft oval lamps with four small LED elements.
    const headlamp = new THREE.Group(); headlamp.position.set(sign*.64,.68,1.77); headlamp.rotation.x=1.02; headlamp.scale.set(.85,1,1.18); shell.add(headlamp);
    mesh(new THREE.CylinderGeometry(.191,.191,.027,32),black,headlamp);
    const halo = mesh(new THREE.TorusGeometry(.153,.014,8,36),light,headlamp,0,.019,0); halo.rotation.x=Math.PI/2;
    for(const a of [-1,1]) for(const b of [-1,1]) box(headlamp,light,.038,.018,.038,a*.058,.022,b*.06);
    box(shell,black,.42,.065,.025,sign*.44,.39,2.08);
    const exhaust = mesh(new THREE.CylinderGeometry(.075,.075,.13,16),black,shell,sign*.6,.32,-2.08); exhaust.rotation.x=Math.PI/2;
  }
  box(shell,red,1.43,.035,.035,0,.726,-2.035);
  box(shell,black,1.27,.12,.045,0,.39,-2.08);
  for(let i=0;i<9;i++) box(shell,black,.035,.018,.4,(i-4)*.088,.864,-1.55);
  box(shell,black,.5,.13,.02,0,.43,2.18);
  for(const sign of [-1,1]) for(const z of [-1.35,1.33]) {
    const wheel=part('wheels',new THREE.Vector3(sign*.87,.11,z>0?.12:-.12));
    wheel.position.set(sign*.92,.43,z); parts[parts.length-1].origin.copy(wheel.position);
    const rubber = mesh(new THREE.TorusGeometry(.295,.105,16,48),tire,wheel); rubber.rotation.y=Math.PI/2;
    const rimFace = mesh(new THREE.CylinderGeometry(.258,.258,.065,40),rims,wheel,sign*.082); rimFace.rotation.z=Math.PI/2;
    const disc=mesh(new THREE.CylinderGeometry(.211,.211,.069,32),brake,wheel,sign*.09); disc.rotation.z=Math.PI/2;
    for(let i=0;i<10;i++) {
      const angle=i*Math.PI/5;
      const spoke=box(wheel,rims,.035,.033,.224,sign*.126,Math.sin(angle)*.119,Math.cos(angle)*.119); spoke.rotation.x=-angle;
    }
    const hub=mesh(new THREE.CylinderGeometry(.07,.07,.073,20),rims,wheel,sign*.13); hub.rotation.z=Math.PI/2;
    box(wheel,new THREE.MeshStandardMaterial({color:'#ad382b',roughness:.35}),.06,.17,.08,sign*.075,.02,-.155);
  }
  const engine=part('powertrain',new THREE.Vector3(0,.7,-1.95));
  engine.position.set(0,.54,-1.35); parts[parts.length-1].origin.copy(engine.position);
  box(engine,brake,.88,.24,.65);
  box(engine,black,.54,.12,.52,0,.18,0);
  for(const sign of [-1,1]) for(let i=0;i<3;i++) {
    const cylinder=mesh(new THREE.CylinderGeometry(.12,.12,.31,12),brake,engine,sign*.4,-.02,(i-1)*.19); cylinder.rotation.z=Math.PI/2;
    const pipe = mesh(new THREE.TorusGeometry(.12,.035,8,16,Math.PI),brake,engine,sign*.24,.17,(i-1)*.17); pipe.rotation.y=Math.PI/2;
  }
  return {group,parts,paint,rims};
}
