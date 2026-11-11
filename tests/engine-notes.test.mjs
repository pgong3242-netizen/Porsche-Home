import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const html=readFileSync(new URL('../public/engine-brokendown/index.html',import.meta.url),'utf8');
const source=html.split('/* PART NOTES START */')[1].split('/* PART NOTES END */')[0];
function setup(){
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,style:{},attributes:{},children:[],events:{},
      setAttribute(key,value){this.attributes[key]=String(value);},
      toggleAttribute(key,on){if(on)this.attributes[key]='';else delete this.attributes[key];},
      addEventListener(key,fn){this.events[key]=fn;},append(child){this.children.push(child);},
      querySelector(selector){return node(id+selector);},
      getBoundingClientRect(){return {left:900,right:1160,top:30,bottom:390,height:360};},
    });
    return nodes.get(id);
  };
  let created=0;
  const document={getElementById:node,createElement:()=>node(`button-${created++}`)};
  const tags=['piston','crank','head','plenum','turbo','flywheel'];
  const parts=tags.map(tag=>({tag,o:new THREE.Group()}));
  const camera=new THREE.PerspectiveCamera(45,1200/800,.1,100);camera.position.z=10;camera.updateMatrixWorld();
  const api=new Function('document','THREE','parts','camera','innerWidth','innerHeight',source+'\nreturn {updatePartNote,partNotes};')(document,THREE,parts,camera,1200,800);
  return {...api,node,parts,camera};
}

test('all six notes select the corresponding real assembly part and update accessible copy',()=>{
  const app=setup(),buttons=app.node('part-menu').children;
  assert.equal(buttons.length,6);
  for(const [index,note] of app.partNotes.entries()){
    assert(html.includes(`'${note.tag}'`),'note refers to an existing assembly tag');
    buttons[index].events.click();
    assert.equal(app.node('part-title').textContent,note.name);
    assert.equal(app.node('part-description').textContent,note.text);
    assert.equal(buttons.filter(button=>button.attributes['aria-pressed']==='true').length,1);
    assert.equal(buttons[index].attributes['aria-pressed'],'true');
  }
});

test('annotation follows exploded parts, throttles updates and hides behind camera',()=>{
  const app=setup();
  app.updatePartNote(0);
  assert.equal(app.node('part-marker').hidden,false);
  const initial=app.node('part-marker').style.transform;
  app.parts[0].o.position.x=1;
  app.updatePartNote(.01);
  assert.equal(app.node('part-marker').style.transform,initial,'no layout update above 30 Hz');
  app.updatePartNote(.1);
  assert.notEqual(app.node('part-marker').style.transform,initial);
  app.parts[0].o.position.z=20;
  app.updatePartNote(.2);
  assert.equal(app.node('part-marker').hidden,true);
  assert('hidden' in app.node('part-leader').attributes);
});
