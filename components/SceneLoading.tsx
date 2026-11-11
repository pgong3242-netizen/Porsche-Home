'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
// 场景加载提示：居中的保时捷盾徽（public/porsche-crest.png）+ 进度条。场景就绪后自动淡出，不需要点击进入。
export default function SceneLoading({visible,progress,stage}:{visible:boolean;progress:number;stage:string}){
  const [mounted,setMounted]=useState(visible),[leaving,setLeaving]=useState(false);
  useEffect(()=>{
    if(visible){const frame=requestAnimationFrame(()=>{setMounted(true);setLeaving(false);});return ()=>cancelAnimationFrame(frame);}
    if(!mounted)return;
    const frame=requestAnimationFrame(()=>setLeaving(true));
    const id=window.setTimeout(()=>{setMounted(false);setLeaving(false);},480);
    return ()=>{cancelAnimationFrame(frame);window.clearTimeout(id);};
  },[visible,mounted]);
  if(!mounted)return null;
  const value=Math.min(99,Math.max(0,Math.round(progress)));
  const label=stage||'正在打开你的私人世界';
  return <div className={`scene-loading ${leaving?'is-leaving':''}`} role="status" aria-live="polite">
    <div className="scene-loading-emblem" aria-hidden="true">
      <Image src="./porsche-crest.png" alt="" width={240} height={318} unoptimized priority/>
    </div>
    <div className="scene-loading-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${value}%`}}/></div>
    <p className="scene-loading-meta"><span>{label}</span><strong>{value}<small>%</small></strong></p>
  </div>;
}
