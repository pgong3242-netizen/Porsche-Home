import * as THREE from 'three';

/** Code-native landscape details and original 911-inspired exhibition graphics. */
export function addWorldDetails(world:THREE.Group,home:THREE.Group) {
  const textures:THREE.Texture[]=[];
  const mat=(color:string,roughness=.78,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const cream=mat('#ded4ba'),stone=mat('#a59b81'),wood=mat('#7e6148'),dark=mat('#303b34'),red=mat('#ad2332'),leaf=mat('#566d48');
  const glow=new THREE.MeshStandardMaterial({color:'#f8e2ac',emissive:'#fbd797',emissiveIntensity:.65});
  const add=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,x:number,y:number,z:number)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(p:THREE.Object3D,m:THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number)=>add(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  function graphic(title:string,subtitle:string,w:number,h:number,x:number,y:number,z:number,parent:THREE.Group,rotation=0,theme='dark'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const c=canvas.getContext('2d')!;
    c.fillStyle=theme==='dark'?'#25352d':theme==='silver'?'#b8c3ca':'#ede7d7';c.fillRect(0,0,1024,384);c.fillStyle=theme==='dark'?'#e8e4d7':theme==='silver'?'#991a2d':'#334a3b';
    c.font='500 94px Arial';c.textAlign='center';c.fillText(title,512,169);c.fillStyle='#b52635';c.fillRect(462,206,100,5);
    c.fillStyle=theme==='dark'?'#aebbac':'#788773';c.font='26px Arial';c.fillText(subtitle,512,273);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const o=add(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),parent,x,y,z);o.rotation.y=rotation;o.castShadow=false;return o;
  }
  graphic('PORSCHE','PRIVATE ATELIER  /  911',5.9,2.2,27.6,3.15,-11.61,world);
  graphic('911','CURVES BECOME MEMORIES',2.8,1.05,-22,4.05,-18.64,world,0,'light');
  graphic('WELCOME HOME','A PLACE FOR YOUR PASSION',2.25,.84,-3.7,2.4,-1.72,home,0,'light');
  graphic('LETTERS FROM THE ROAD','LEAVE A LITTLE MEMORY',2.2,.83,-25,2.7,14.42,world,0,'light');
  // A restrained red racing line ties the architecture to the vehicle.
  box(world,red,12,.028,.12,26,.304,-.2);box(world,cream,12,.028,.045,26,.306,.02);
  box(home,red,.08,.028,6.2,5.1,.33,3.2);box(home,cream,.04,.028,6.2,5.28,.33,3.2);
  for(let i=0;i<4;i++){const tire=add(new THREE.TorusGeometry(.39,.13,9,24),dark,world,21.25,.43+i*.27,-9.1);tire.rotation.x=Math.PI/2;}
  box(world,red,1.15,.68,.6,22.1,.84,-9.7);box(world,wood,1.25,.08,.72,22.1,1.23,-9.7);
  for(let i=0;i<3;i++)box(world,cream,.7,.025,.025,22.1,.7+i*.15,-9.385);
  for(const x of[21.7,22.5])for(const z of[-9.9,-9.5]){const wheel=add(new THREE.CylinderGeometry(.09,.09,.05,12),dark,world,x,.43,z);wheel.rotation.z=Math.PI/2;}
  // A sweeping private driveway: painted curbs and dashed lane markings.
  const curve=new THREE.CatmullRomCurve3([[26,-18],[35,-14],[38,-3],[33,13],[20,24],[8,26],[6,31],[6,37]].map(([x,z])=>new THREE.Vector3(x,.054,z)));
  const positions:number[]=[],indices:number[]=[];const width=2.65;
  for(let i=0;i<=90;i++){const t=i/90,p=curve.getPoint(t),d=curve.getTangent(t),n=new THREE.Vector3(-d.z,0,d.x).multiplyScalar(width/2);positions.push(p.x+n.x,p.y,p.z+n.z,p.x-n.x,p.y,p.z-n.z);if(i<90){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}}
  const roadGeometry=new THREE.BufferGeometry();roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));roadGeometry.setIndex(indices);roadGeometry.computeVertexNormals();
  const road=add(roadGeometry,mat('#626b60'),world,0,0,0);road.castShadow=false;
  const curbWhite=new THREE.InstancedMesh(new THREE.BoxGeometry(.22,.065,.62),cream,90),curbRed=new THREE.InstancedMesh(new THREE.BoxGeometry(.22,.065,.62),red,90);
  const dash=new THREE.InstancedMesh(new THREE.BoxGeometry(.07,.012,.64),cream,40);const dummy=new THREE.Object3D();
  for(let i=0;i<90;i++){const t=i/89,p=curve.getPoint(t),d=curve.getTangent(t);for(const side of[-1,1]){const offset=new THREE.Vector3(-d.z,0,d.x).multiplyScalar(side*(width/2+.03));dummy.position.copy(p).add(offset);dummy.position.y=.087;dummy.rotation.set(0,Math.atan2(d.x,d.z),0);dummy.updateMatrix();(i%2?curbRed:curbWhite).setMatrixAt(Math.floor(i/2)*2+(side===1?1:0),dummy.matrix);}}
  for(let i=0;i<40;i++){const p=curve.getPoint(i/39),d=curve.getTangent(i/39);dummy.position.copy(p);dummy.position.y=.067;dummy.rotation.set(0,Math.atan2(d.x,d.z),0);dummy.updateMatrix();dash.setMatrixAt(i,dummy.matrix);}world.add(curbWhite,curbRed,dash);
  graphic('911 PRIVATE DRIVE','ENJOY THE CURVES',2.4,.9,28.4,1.8,-18.3,world,-.4,'light');box(world,wood,.07,1.35,.07,28.4,.8,-18.3);
  // Flower borders use a handful of instanced meshes rather than hundreds of draw calls.
  const beds:[number,number,number,number][]=[[-12,-4,2.1,.85],[-12,5,1.9,.7],[-10,14,2.8,.8],[-29,-16,1.8,.95],[-25,-23,3.1,1.1],[-17,-21,1.7,.8],[-29,18,1.8,.85],[-22,27,3.2,.9],[-14,23,1.8,.9],[18,-13,2.2,.7],[32,-16,2.5,.85],[18,5,2,.7],[10,-16,2.3,.8],[4,16,2.4,.8],[6,-19,2.1,.9]];
  let seed=911;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const flowersPerBed=40,total=beds.length*flowersPerBed;
  const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.013,.018,1,4),leaf,total);
  const colors=['#d6b7af','#e6dfbf','#b8a3c4','#d0bc75'];
  const heads=colors.map(c=>new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.105,1),mat(c),Math.ceil(total/4)));
  const tufts=new THREE.InstancedMesh(new THREE.ConeGeometry(.16,.62,4),leaf,beds.length*15);
  let f=0,g=0;
  for(const[x,z,rx,rz]of beds){
    const rim=add(new THREE.TorusGeometry(1,.055,5,40),stone,world,x,.07,z);rim.rotation.x=Math.PI/2;rim.scale.set(rx,rz,1);rim.castShadow=false;
    for(let i=0;i<flowersPerBed;i++){
      const a=random()*Math.PI*2,r=Math.sqrt(random())*.88,px=x+Math.cos(a)*r*rx,pz=z+Math.sin(a)*r*rz,h=.25+random()*.36;
      dummy.position.set(px,.08+h/2,pz);dummy.rotation.set(0,0,0);dummy.scale.set(1,h,1);dummy.updateMatrix();stems.setMatrixAt(f,dummy.matrix);
      dummy.position.y=.09+h;dummy.scale.setScalar(.7+random()*.6);dummy.updateMatrix();heads[f%4].setMatrixAt(Math.floor(f/4),dummy.matrix);f++;
    }
    for(let i=0;i<15;i++){const a=random()*Math.PI*2;dummy.position.set(x+Math.cos(a)*rx*.86,.28,z+Math.sin(a)*rz*.86);dummy.rotation.set((random()-.5)*.3,a,.1);dummy.scale.setScalar(.7+random()*.6);dummy.updateMatrix();tufts.setMatrixAt(g++,dummy.matrix);}
  }
  world.add(stems,tufts,...heads);
  // A small reflecting pool and timber footbridge add a quiet place between visits.
  const pond=new THREE.Group();pond.position.set(-8.8,0,-18);world.add(pond);
  const basin=add(new THREE.CylinderGeometry(3.1,3.25,.12,48),stone,pond,0,.06,0);basin.scale.z=.62;
  const pool=add(new THREE.CircleGeometry(2.98,48),new THREE.MeshPhysicalMaterial({color:'#6d9e98',metalness:.2,roughness:.18,clearcoat:1}),pond,0,.13,0);pool.rotation.x=-Math.PI/2;pool.scale.y=.61;pool.castShadow=false;
  for(let i=0;i<14;i++)box(pond,wood,4.7,.09,.2,0,.35,-1.37+i*.21);
  for(const x of[-2.3,2.3]){box(pond,wood,.055,.055,3.1,x,1.02,0);for(const z of[-1.4,0,1.4])box(pond,wood,.055,.7,.055,x,.69,z);}
  for(const[x,z,s]of[[-2.8,-1.1,.5],[2.7,1.2,.45],[2.1,-1.5,.36]] as number[][]){const rock=add(new THREE.IcosahedronGeometry(s,1),stone,pond,x,.19,z);rock.scale.y=.6;}
  // String lights and tiny postcards make the guest terrace feel inhabited.
  const stringPoints=[];for(let i=0;i<=24;i++){const t=i/24;stringPoints.push(new THREE.Vector3(-25.6+t*8,3.85-Math.sin(t*Math.PI)*.55,17.35));}
  const wire=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stringPoints),24,.016,4,false),dark,world,0,0,0);wire.castShadow=false;
  for(let i=1;i<12;i++){const p=stringPoints[i*2];add(new THREE.SphereGeometry(.055,6,5),glow,world,p.x,p.y-.08,p.z);}
  for(let i=0;i<3;i++){const card=box(world,i===1?red:cream,.28,.012,.18,-21.6+i*.28,1.4,17.05);card.rotation.y=i*.4;}
  // Direction signs create discoveries at the path junctions.
  for(const[x,z,text]of[[-13,9,'HOME / FRIENDS'],[13,-4,'ATELIER / 911'],[-13,-12,'MEMORIES / HOME']] as [number,number,string][]){box(world,wood,.07,1.45,.07,x,.75,z);graphic(text,'FOLLOW YOUR CURIOSITY',1.95,.73,x,1.75,z,world,.18,'light');}
  const entrance = new THREE.Group();
  entrance.name = 'garden-entrance';
  world.add(entrance);
  // The first arrival is at a real garden gate, with sliding leaves and a clear approach.
  box(entrance,stone,12,.09,2.1,6,0,30);
  for(const x of[.8,11.2]){
    box(entrance,stone,1.05,3.35,1.05,x,1.68,30);box(entrance,cream,1.2,.16,1.2,x,3.43,30);
    box(entrance,dark,.2,1.2,.06,x,2.18,30.56);box(entrance,glow,.035,1.02,.025,x,2.2,30.602);
  }
  box(entrance,dark,11.5,.58,.7,6,4.08,30);box(entrance,red,10.6,.035,.04,6,3.77,30.38);
  graphic('七只烧鸡','YOUR PRIVATE WORLD',7.7,.83,6,4.15,30.37,entrance);
  graphic('911','HOME',.72,.66,11.2,1.27,30.545,entrance,0,'light');
  const gateLeaves=[new THREE.Group(),new THREE.Group()];
  gateLeaves.forEach((gate,i)=>{gate.position.set(i?8.5:3.5,0,30);entrance.add(gate);box(gate,dark,4.8,.13,.13,0,.31,0);box(gate,dark,4.8,.12,.13,0,2.66,0);for(let j=0;j<17;j++)box(gate,dark,.055,2.33,.07,-2.23+j*.279,1.49,0);box(gate,red,.045,2.27,.085,i?-2.33:2.33,1.49,.015);});
  for(const x of[-1.2,13.2]){add(new THREE.CylinderGeometry(.48,.36,.67,16),stone,entrance,x,.37,31.25);const shrub=add(new THREE.IcosahedronGeometry(.65,1),leaf,entrance,x,1.05,31.25);shrub.scale.y=.9;}

  // Small destinations in the outer landscape keep the central garden open.
  for (const [x,z,title,subtitle] of [
    [-35,-8,'PORSCHE','HERITAGE GARDEN'],
    [35,15,'E-PERFORMANCE','CHARGING LOUNGE'],
  ] as [number,number,string,string][]) {
    const pocket = new THREE.Group();
    pocket.name = 'garden-rest-area';
    pocket.position.set(x,0,z);
    world.add(pocket);
    add(new THREE.CylinderGeometry(4.5,4.7,.18,36),cream,pocket,0,.08,0);
    graphic(title,subtitle,4,1.5,0,2.1,-2.6,pocket);
    for (const side of [-1,1]) {
      box(pocket,wood,2.4,.16,.65,side*2,.6,1);
      for (const dx of [-.85,.85]) box(pocket,dark,.1,.55,.45,side*2+dx,.29,1);
      for (let n=0;n<5;n++) {
        const a=n*.6;
        add(new THREE.IcosahedronGeometry(.42,1),leaf,pocket,side*(3.2+Math.sin(a)*.4),.45,-1+n*.65);
      }
    }
    if (title === 'E-PERFORMANCE') {
      for (const dx of [-1,1]) {
        box(pocket,cream,.42,1.3,.35,dx,.7,-.8);
        box(pocket,dark,.29,.4,.03,dx,1,-.61);
        box(pocket,red,.07,.7,.04,dx+.2,.8,-.59);
      }
    } else {
      const sculpture = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.7,.8,0), new THREE.Vector3(-1.1,1.2,0),
        new THREE.Vector3(-.4,1.95,0), new THREE.Vector3(.6,2,0),
        new THREE.Vector3(1.2,1.3,0), new THREE.Vector3(1.7,.9,0),
      ]);
      add(new THREE.TubeGeometry(sculpture,40,.055,6,false),red,pocket,0,0,0);
    }
  }
  const trees = new THREE.Group();trees.name='courtyard-trees';world.add(trees);
  const treePositions=[[-32,-20],[-28,-25],[-15,-22],[14,-24],[30,-23],[39,-4],[34,25],[15,24],[-20,29],[-34,16]];
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.18,1.8,6),wood,treePositions.length);
  const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15,1),leaf,treePositions.length);
  const treeMatrix=new THREE.Object3D();
  treePositions.forEach(([x,z],i)=>{
    treeMatrix.position.set(x,.9,z);treeMatrix.scale.set(1,1,1);treeMatrix.updateMatrix();trunks.setMatrixAt(i,treeMatrix.matrix);
    treeMatrix.position.y=2.4;treeMatrix.scale.set(1,1.3,1);treeMatrix.updateMatrix();crowns.setMatrixAt(i,treeMatrix.matrix);
  });
  crowns.castShadow=true;trees.add(trunks,crowns);

  // Vector outline from the Porsche Design System wordmark (4500 × 300).
  const wordmarkOutline = new Path2D('M502 221c48.1 0 74-25.9 74-74V74c0-48.1-25.9-74-74-74H0v300h68v-79h434zm6-143v65c0 7.8-4.2 12-12 12H68V66h428c7.8 0 12 4.2 12 12zm228 222c-48.1 0-74-25.9-74-74V74c0-48.1 25.9-74 74-74h417c48.1 0 74 25.9 74 74v152c0 48.1-25.9 74-74 74H736zm411-66c7.8 0 12-4.2 12-12V78c0-7.8-4.2-12-12-12H742c-7.8 0-12 4.2-12 12v144c0 7.8 4.2 12 12 12h405zm675-36c39.844 16.757 67.853 56.1 68 102h-68c0-54-25-79-79-79h-361v79h-68V0h502c48.1 0 74 25.9 74 74v50.14c0 46.06-23.75 71.76-68 73.86zm-12-43c7.8 0 12-4.2 12-12V78c0-7.8-4.2-12-12-12h-428v89h428zm162-81c0-48.1 25.9-74 74-74h492v56h-486c-7.8 0-12 4.2-12 12v42c0 7.8 4.2 12 12 12h422c48.1 0 74 25.9 74 74v30c0 48.1-25.9 74-74 74h-492v-56h486c7.8 0 12-4.2 12-12v-42c0-7.8-4.2-12-12-12h-422c-48.1 0-74-25.9-74-74V74zm661 0c0-48.1 25.9-74 74-74h480v66h-474c-7.8 0-12 4.2-12 12v144c0 7.8 4.2 12 12 12h474v66h-480c-48.1 0-74-25.9-74-74V74zM3817 0v300h-68V183h-407v117h-68V0h68v117h407V0h68zm156 56v66h527v56h-527v66h527v56h-595V0h595v56h-527z');
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1536;
  signCanvas.height = 112;
  const signContext = signCanvas.getContext('2d')!;
  signContext.setTransform(1/3,0,0,1/3,18,5);
  signContext.fillStyle = '#710e1b';
  signContext.translate(0,9);
  signContext.fill(wordmarkOutline);
  signContext.translate(0,-9);
  signContext.fillStyle = '#c71e32';
  signContext.fill(wordmarkOutline);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  textures.push(signTexture);
  const signMaterial = new THREE.MeshBasicMaterial({map:signTexture,transparent:true,depthWrite:false,alphaTest:.02});
  function facadeWordmark(parent:THREE.Group,width:number,x:number,y:number,z:number) {
    const sign = add(new THREE.PlaneGeometry(width,width*112/1536),signMaterial,parent,x,y,z);
    sign.castShadow = false;
  }

  const campuses = new Map<string,THREE.Group>();
  function buildCampus(key:string) {
    const campus=new THREE.Group();
    home.add(campus);
    campus.name=key;
    campuses.set(key,campus);
    const research=key==='porsche-rd';
    if(research) {
      box(campus,stone,8,.2,12,-15,.2,-7);
      box(campus,stone,10.5,.2,12,1.5,.2,-3);
    } else box(campus,stone,17,.2,12,-2,.2,-3);
    const silver = mat('#b8c3ca',.42,.35);
    const mullion = mat('#53616d',.48,.3);
    const blueGlass = mat('#6d91a6',.19,.42);
    function tower(x:number,z:number,w:number,d:number,height:number) {
      box(campus,blueGlass,w,height,d,x,height/2+.3,z);
      for(let y=.5;y<height;y+=.65) {
        box(campus,mullion,w+.05,.035,d+.05,x,y,z);
      }
      for(let dx=-w/2;dx<=w/2;dx+=.48) {
        box(campus,silver,.045,height,.08,x+dx,height/2+.3,z+d/2+.04);
        box(campus,silver,.045,height,.08,x+dx,height/2+.3,z-d/2-.04);
      }
      for(let dz=-d/2;dz<=d/2;dz+=.48) {
        box(campus,silver,.08,height,.045,x-w/2-.04,height/2+.3,z+dz);
        box(campus,silver,.08,height,.045,x+w/2+.04,height/2+.3,z+dz);
      }
      box(campus,silver,w+.16,.16,d+.16,x,height+.38,z);
    }
    if (research) {
      const asphalt=mat('#44484c',.95),curb=mat('#aeb3b6');
      const street=new THREE.Group();street.name='porsche-street';campus.add(street);
      box(street,asphalt,6,.06,60,-7.5,.02,-12);
      for(const x of [-10.7,-4.3]) {
        box(street,curb,.3,.22,60,x,.11,-12);
        box(street,cream,.1,.015,60,x+(x<-7.5?.4:-.4),.06,-12);
      }
      for(let z=-40;z<=15;z+=5)box(street,cream,.12,.015,2.5,-7.5,.06,z);
      for(let x=-10;x<=-5;x+=.8)box(street,cream,.4,.015,3.2,x,.065,-16);
      const streetName=graphic('PORSCHE','STREET / JIANGQIAO',9,1.8,-9,.07,7,street,0,'dark');
      streetName.rotation.set(-Math.PI/2,0,Math.PI/2);
      // Separate office and laboratory foundations leave a clear north–south street.
      tower(-16,-6.8,5.4,5.1,11.8);
      facadeWordmark(campus,4.25,-16,11.34,-4.11);
      tower(-12.1,-8,2.2,4.1,10.6);
      box(campus,mullion,8.5,1.5,10.6,1.5,1,-3.5);
      box(campus,silver,8.5,3.3,10.6,1.5,3.4,-3.5);
      // Horizontal cladding seams on the front and long side.
      for(let y=2;y<=4.9;y+=.48) {
        box(campus,mullion,8.52,.018,.025,1.5,y,1.815);
        box(campus,mullion,.025,.018,10.62,5.765,y,-3.5);
      }
      for(let x=-2.5;x<5.8;x+=1.4)
        box(campus,mullion,.015,3.3,.026,x,3.4,1.818);
      for(let z=-8.5;z<1.6;z+=1.4)
        box(campus,mullion,.026,3.3,.015,5.768,3.4,z);
      for(let x=-2.2;x<3.4;x+=1.15)
        box(campus,blueGlass,.84,.52,.04,x,3.15,1.84);
      for(let z=-7.8;z<.6;z+=1.25)
        box(campus,blueGlass,.04,.55,.86,5.79,3.7,z);
      // Full-height glazed corner and recessed dark entrance.
      box(campus,blueGlass,1.5,3.9,.06,4.95,2.8,1.86);
      box(campus,blueGlass,.06,3.9,1.55,5.81,2.8,1.05);
      for(let y=1;y<4.8;y+=1.1) {
        box(campus,mullion,1.53,.06,.08,4.95,y,1.91);
        box(campus,mullion,.08,.06,1.58,5.85,y,1.05);
      }
      box(campus,dark,3.5,1.4,.12,-.25,1,1.85);
      box(campus,dark,4.4,.16,1.2,-.25,1.79,2.25);
      facadeWordmark(campus,3.55,-.5,4.23,1.865);
      graphic('JIANGQIAO','RESEARCH & DEVELOPMENT',2.3,.75,-1,1.65,2.22,campus,0,'light');
      const offices=new THREE.Group(),laboratory=new THREE.Group();
      offices.name='research-offices';laboratory.name='research-laboratory';
      for(const node of [...campus.children]) {
        if(node===street)continue;
        (node.position.x<-7.5?offices:laboratory).add(node);
      }
      for(const building of [offices,laboratory]) {
        // Lengthen toward the rear so the forecourt and parking remain clear.
        const front=new THREE.Box3().setFromObject(building).max.z;
        building.scale.z=3;building.position.z=-2*front;campus.add(building);
      }
    } else {
      // Lujiazui headquarters is represented as offices within an urban tower.
      tower(-2,-5,7,6,16.2);
      facadeWordmark(campus,5.5,-2,14.95,-1.86);
      tower(4.7,-6.8,4.8,5,11);
      box(campus,silver,14,1.4,8,-1,.9,-3.7);
      box(campus,blueGlass,13.7,1.05,.08,-1,.9,.36);
      box(campus,dark,4,.12,2,-2,1.65,1.1);
      for(let floor=11;floor<=16;floor++) {
        box(campus,cream,6.8,.06,.1,-2,floor,.04-2);
      }
      graphic('PORSCHE CHINA','LUJIAZUI / FINANCIAL PLAZA',4.5,1.1,-2,1.05,2.14,campus);
      // A compact urban forecourt with paving and a street-side directory.
      for(let n=0;n<7;n++) box(campus,cream,.55,.025,1.7,-6+n*1.2,.32,5.7);
      box(campus,mullion,.65,2.2,.3,5.6,1.35,2.8);
      graphic('T3','OFFICES',.59,.72,5.6,1.9,2.97,campus,0,'light');
    }
    if(!research) for(const x of [-7,5]) {
      box(campus,wood,2,.16,.65,x,.7,4);
      add(new THREE.CylinderGeometry(.6,.5,.7,12),stone,campus,x,.5,1.7);
      add(new THREE.IcosahedronGeometry(.85,1),leaf,campus,x,1.4,1.7);
    }
    if (research) {
      // The front apron clears the entrance, benches, pool and charging posts.
      box(campus,stone,10.5,.18,7.4,1.25,.25,11.8);
      for (const x of [-2,2]) {
        for (const side of [-1,1]) box(campus,cream,.045,.012,5.4,x+side*1.35,.346,12.1);
        box(campus,cream,2.7,.012,.045,x,.346,9.4);
      }
    }
    if(research) for(let n=0;n<3;n++) {
      box(campus,cream,.45,1.35,.4,-1+n*1.5,.8,5.5);
      box(campus,dark,.3,.4,.04,-1+n*1.5,1,5.73);
      box(campus,red,1.1,.025,2,-1+n*1.5,.32,7);
    }
  }
  return {setCampus:(key?:string)=>{entrance.visible=key!=='porsche-rd';if(key && ['porsche-china','porsche-rd'].includes(key) && !campuses.has(key))buildCampus(key);campuses.forEach((campus,id)=>{campus.visible=id===key;});},setGateOpen:(value:number)=>{gateLeaves[0].position.x=3.5-value*4.4;gateLeaves[1].position.x=8.5+value*4.4;},dispose:()=>textures.forEach(t=>t.dispose())};
}
