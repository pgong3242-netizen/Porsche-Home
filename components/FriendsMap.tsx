'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Demo visits read URL parameters on mount. */

import Image from 'next/image';
import { useState } from 'react';
import { ArrowUpRight, Camera, Coffee, Flag, Palmtree, Route, Sun, Trees, Trophy, Users, Waves } from 'lucide-react';

const sampleMapFriends = [
  { name: '沪上慢游', city: '上海', km: 38.6, x: 83, y: 49, icon: Coffee, color: '#a06546' },
  { name: '落日巡游', city: '洛杉矶', km: 112.8, x: 10, y: 38, icon: Camera, color: '#8b6c9b' },
  { name: '椰风来信', city: '里约', km: 67.2, x: 29, y: 72, icon: Palmtree, color: '#50816c' },
  { name: '追光小队', city: '开罗', km: 54.1, x: 52, y: 51, icon: Sun, color: '#9a7531' },
  { name: '海盐周末', city: '悉尼', km: 91.5, x: 84, y: 91, icon: Waves, color: '#527e99' },
];

// shortcut: illustrative weekly distances, replace with dated mileage records when a data source is connected.
export const weeklyMileage = [
  { name: '江桥研发中心', city: '上海', km: 86.4, friend: true },
  { name: 'Alpine Sunday', city: '慕尼黑', km: 218.6, friend: true },
  { name: 'Coastline 911', city: '洛杉矶', km: 176.2, friend: false },
  { name: 'Forest Drive', city: '斯图加特', km: 142.8, friend: false },
  { name: '晨风 911', city: '杭州', km: 128.6, friend: true },
  { name: '海边的阿辰', city: '青岛', km: 104.3, friend: true },
  { name: '山间来信', city: '成都', km: 96.8, friend: true },
  { name: '小林的周末', city: '苏州', km: 72.1, friend: true },
  { name: '晚风 Carrera', city: '深圳', km: 58.7, friend: true },
  { name: '松林慢行', city: '杭州', km: 43.2, friend: true },
  { name: 'Morning Miles', city: '新加坡', km: 62.5, friend: false },
  ...sampleMapFriends.map(({ name, city, km }) => ({ name, city, km, friend: true })),
].sort((a, b) => b.km - a.km);

export default function FriendsMap() {
  const [scope, setScope] = useState<'friends' | 'world'>('friends');
  const ranking = scope === 'friends' ? weeklyMileage.filter(driver => driver.friend) : weeklyMileage;

  return <section className="friends-map" aria-label="手绘世界好友地图与每周里程榜">
    <div className="friends-map-layout">
      <div className="illustrated-map">
        <div className="map-artwork">
          <Image src="./images/porsche-world-landmarks.webp" alt="手绘世界好友地图：薄荷色海面、彩色微缩大陆、卡通地标与两辆 Porsche 跑车，各地分布着示例车友，慕尼黑穹顶之家可点击拜访。" width={1619} height={971} priority unoptimized sizes="(max-width: 760px) 100vw, 75vw"/>
          {sampleMapFriends.map(({ name, city, x, y, icon: Icon, color }) => <span key={name} className="map-sample-friend" style={{ left: `${x}%`, top: `${y}%`, color }} aria-label={`${city} · ${name}（示例车友）`}><Icon size={17} aria-hidden="true"/><span><strong>{name}</strong><small>{city}</small></span></span>)}
          <a className="map-shanghai-pin map-munich-pin" href="./?demo=munich" aria-label="拜访慕尼黑穹顶之家"><span className="map-pin-icon"><Trees size={18} aria-hidden="true"/></span><span><strong>慕尼黑</strong><small>穹顶之家 · 去串门</small></span><ArrowUpRight size={16} aria-hidden="true"/></a>
          <div className="map-podium" role="group" aria-label={scope === 'friends' ? '好友榜前三名' : '世界榜前三名'} aria-live="polite">{ranking.slice(0, 3).map((driver, index) => <div key={driver.name} className={`map-podium-driver place-${index + 1}`}><span className="map-medal" aria-label={`第 ${index + 1} 名`}>{index + 1}</span><span><strong>{driver.name}</strong><small>{driver.km.toFixed(1)} km</small></span></div>)}</div>
        </div>
        <div className="map-bottom-note"><span><i/> 1 处可拜访空间 · 其余为示例车友</span></div>
      </div>
      <aside className="mileage-board" aria-label="每周行驶里程排行榜">
        <div className="mileage-heading"><span className="mileage-trophy"><Trophy size={23} strokeWidth={1.5}/></span><div><p className="eyebrow">WEEKLY MILEAGE</p><h2>周里程榜</h2></div><span className="mileage-demo">演示</span></div>
        <div className="mileage-scope" role="group" aria-label="排行范围"><button aria-pressed={scope === 'friends'} onClick={() => setScope('friends')}><Users size={14}/>好友榜</button><button aria-pressed={scope === 'world'} onClick={() => setScope('world')}><Flag size={14}/>世界榜</button></div>
        <div className="mileage-columns"><span>排名 / 车友</span><span>每周里程</span></div>
        <ol className="mileage-list" tabIndex={0} aria-live="polite" aria-label={scope === 'friends' ? '好友每周里程排名' : '世界每周里程排名'}>{ranking.map((driver, index) => <li key={driver.name}><span className={`mileage-position ${index === 0 ? 'is-first' : ''}`}>{String(index + 1).padStart(2, '0')}</span><div><strong>{driver.name}</strong><small>{driver.city}{driver.friend ? ' · 好友' : ''}</small></div><span className="mileage-distance">{driver.km.toFixed(1)}<small>km</small></span></li>)}</ol>
        <div className="mileage-footnote"><Route size={15}/><p>按每周行驶里程从高到低排列。<br/>示例里程，尚未接入真实驾驶数据。</p></div>
      </aside>
    </div>
  </section>;
}
