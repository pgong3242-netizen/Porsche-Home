'use client';

import { useState } from 'react';
import { ArrowUpRight, CalendarDays, Camera, Flag, Gauge, Globe2, Package, PawPrint, Shirt, Wrench } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { localRecordId, sampleFriends, type Friend, type Memory, type Pet } from '@/lib/demo-world';

export function PhoneEntry({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  let svg: { size: number; path: string } | null = null;
  let local = false;
  try {
    const target = new URL(url.trim());
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password || target.href.length > 400) throw new Error();
    local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
    const qr = qrcode(0, 'M');
    qr.addData(target.href);
    qr.make();
    const size = qr.getModuleCount();
    let path = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qr.isDark(y, x)) path += `M${x + 4},${y + 4}h1v1h-1z`;
      }
    }
    svg = { size: size + 8, path };
  } catch {
    // Invalid or oversized addresses cannot produce a usable QR code.
  }
  return <div className="prototype-qr">
    <p className="modal-copy">扫一扫，在手机上打开同一座家。</p>
    {svg && <svg viewBox={`0 0 ${svg.size} ${svg.size}`} role="img" aria-label="手机体验二维码" shapeRendering="crispEdges">
      <rect width={svg.size} height={svg.size} fill="#fff" />
      <path d={svg.path} fill="#18201c" />
    </svg>}
    <label>手机可访问的地址<input type="url" value={url} maxLength={400} onChange={event => { setUrl(event.target.value); setCopied(false); }} /></label>
    <p className="fine-print">{!svg ? '请输入有效的 HTTP 或 HTTPS 地址。' : local ? '这是本机地址，手机无法直接访问。请输入手机可访问的部署地址，或同一网络里的预览地址。' : '扫码与直接打开使用同一地址，仍受站点访问权限限制。'}</p>
    <button className="primary-button" disabled={!svg} onClick={async () => {
      try { await navigator.clipboard.writeText(url.trim()); setCopied(true); }
      catch { setCopied(false); }
    }}>{copied ? '链接已复制' : '复制手机入口'}</button>
  </div>;
}

export function FriendsPanel({ friends: allFriends, current: activeFriend, onToggle }: { friends: Friend[]; current: Friend | null; onToggle: (friend: Friend) => void }) {
  const friends = allFriends.filter(friend => (friend.key === 'porsche-rd' || friend.key === 'munich'));
  const current = activeFriend && (activeFriend.key === 'porsche-rd' || activeFriend.key === 'munich') ? activeFriend : null;
  return <div className="prototype-content">
    {current && <button className="primary-button" onClick={() => onToggle(current)}>
      {friends.some(friend => friend.key === current.key) ? '从好友列表移除这座家' : '把这座家加入好友列表'}
    </button>}
    <h3>我的好友 <small>{friends.length}</small></h3>
    {friends.length ? <div className="prototype-list">{friends.map(friend => <FriendRow key={friend.key} friend={friend} saved onToggle={onToggle} />)}</div> : <p className="modal-copy">先去朋友家做客，再把它加进列表。收藏保存在当前浏览器。</p>}
    <h3><Globe2 size={16} /> 车友与品牌园区</h3>
    <p className="fine-print">拜访车友庭院，也可以探索保时捷办公与研发园区概念场景。</p>
    <div className="prototype-list">{sampleFriends.filter(friend => (friend.key === 'porsche-rd' || friend.key === 'munich')).map(friend => <FriendRow key={friend.key} friend={friend} saved={friends.some(item => item.key === friend.key)} onToggle={onToggle} />)}</div>
  </div>;
}

function FriendRow({ friend, saved, onToggle }: { friend: Friend; saved: boolean; onToggle: (friend: Friend) => void }) {
  return <article className="prototype-row">
    <div><small>{friend.region}</small><strong>{friend.title}</strong><span>{friend.name}的家</span></div>
    <div className="prototype-actions">
      <button className="quiet-button" onClick={() => onToggle(friend)} aria-label={`${saved ? '移除' : '收藏'}${friend.title}`}>{saved ? '移除' : '收藏'}</button>
      <a className="quiet-button" href={friend.href}>去做客 <ArrowUpRight size={13} /></a>
    </div>
  </article>;
}

const collections = [
  { name: '周末赛道夹克', edition: '01 / PADDOCK', icon: Shirt, detail: '从维修区工作服取色，搭配号码牌织标的联名服饰概念。' },
  { name: '比例车模收藏盒', edition: '02 / MINIATURE', icon: Package, detail: '把最喜欢的车身颜色收进透明展盒，给每台车留一张收藏卡。' },
  { name: '公路旅行相机包', edition: '03 / ROAD TRIP', icon: Camera, detail: '为周末公路旅行设计的收纳概念，把沿路的照片带回记忆展厅。' },
];

export function GalleryPanel({ memories, canEdit, onAdd }: { memories: Memory[]; canEdit: boolean; onAdd: (memory: Memory) => void }) {
  const [tab, setTab] = useState<'memory' | 'collection'>('memory');
  const [category, setCategory] = useState('赛道');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  return <div className="prototype-content">
    <div className="prototype-actions" aria-label="展廊分类">
      <button className="quiet-button" aria-pressed={tab === 'memory'} onClick={() => setTab('memory')}>记忆与成就</button>
      <button className="quiet-button" aria-pressed={tab === 'collection'} onClick={() => setTab('collection')}>联名产品展台</button>
    </div>
    {tab === 'collection' ? <>
      <p className="fine-print">联名主题概念展台，展品为原型示例。</p>
      <div className="prototype-collection">{collections.map(({ name, edition, icon: Icon, detail }) => <details key={name}>
        <summary><div className="prototype-product"><Icon size={39} strokeWidth={1.2} /></div><small>{edition}</small><strong>{name}</strong></summary>
        <p>{detail}</p>
      </details>)}</div>
    </> : <>
      <div className="prototype-list">{memories.map(memory => {
        const Icon = memory.category === '赛道' ? Flag : memory.category === '保养' ? Wrench : CalendarDays;
        return <article className="prototype-row memory-row" key={memory.id}><Icon size={19} /><div>
          <small>{memory.category} · {memory.date}{['track', 'club', 'service'].includes(memory.id) ? ' · 示例' : ''}</small>
          <strong>{memory.title}</strong><p>{memory.note}</p>
        </div></article>;
      })}</div>
      {canEdit && <details className="prototype-add-memory"><summary>添加一段记忆</summary>
        <form className="edit-form" onSubmit={event => {
          event.preventDefault();
          if (!title.trim() || !note.trim() || !date) return;
          onAdd({ id: localRecordId(), category, date, title: title.trim(), note: note.trim() });
          setTitle(''); setDate(''); setNote('');
        }}>
          <div className="prototype-fields"><label>分类<select value={category} onChange={event => setCategory(event.target.value)}><option>赛道</option><option>车主活动</option><option>保养</option></select></label>
          <label>日期<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label></div>
          <label>标题<input value={title} required maxLength={55} onChange={event => setTitle(event.target.value)} /></label>
          <label>故事<textarea value={note} required maxLength={220} rows={2} onChange={event => setNote(event.target.value)} /></label>
          <button className="primary-button" type="submit">存进记忆展厅</button>
        </form>
      </details>}
    </>}
  </div>;
}

export function VehiclePanel() {
  return <div className="prototype-content">
    <p className="modal-copy">911 Carrera 4S · 车况与售后记录 <span className="prototype-badge">演示数据</span></p>
    <dl className="prototype-metrics">
      <div><dt>表显里程</dt><dd>24,680 <small>km</small></dd></div>
      <div><dt>近期驾驶里程</dt><dd>680 <small>km / 30 天</small></dd></div>
      <div><dt>最近保养</dt><dd>2026-08-12</dd></div>
      <div><dt>12V 电池</dt><dd>检测正常</dd></div>
    </dl>
    <h3><Gauge size={16} /> 车况档案</h3>
    <div className="prototype-list">
      <article className="prototype-row"><div><small>2026-08-12 · 售后示例</small><strong>年度保养 / 24,000 km</strong><span>更换机油与滤芯，检查制动系统和轮胎。</span></div></article>
      <article className="prototype-row"><div><small>2026-08-12 · 车况示例</small><strong>12V 蓄电池检测</strong><span>静置电压 12.6 V。此示例车型不适用动力电池健康记录。</span></div></article>
    </div>
    <p className="fine-print">用于演示二手交接时的记录浏览，未接入真实车辆、售后或可核验交易数据。</p>
  </div>;
}

export function PetPanel({ pet, onSave }: { pet: Pet; onSave: (pet: Pet) => void }) {
  const [draft, setDraft] = useState(pet);
  return <form className="edit-form prototype-content" onSubmit={event => {
    event.preventDefault();
    onSave({ ...draft, name: draft.name.trim() || (draft.kind === 'cat' ? '小猫' : '小狗') });
  }}>
    <p className="modal-copy"><PawPrint size={16} /> 选一只小伙伴，让它在庭院里迎接来客。</p>
    <label>宠物<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as Pet['kind'] })}>
      <option value="none">暂不放置</option><option value="cat">猫</option><option value="dog">狗</option>
    </select></label>
    {draft.kind !== 'none' && <label>名字<input maxLength={24} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>}
    <button className="primary-button" type="submit">应用到庭院</button>
    <p className="fine-print">原型设置保存在当前浏览器。</p>
  </form>;
}
