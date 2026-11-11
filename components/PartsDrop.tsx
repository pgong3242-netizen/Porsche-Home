'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Egg, RotateCcw, Sparkles, Volume2, VolumeX, Wrench } from 'lucide-react';
import { CARD_BACK, ENGINE_EXPLODED_VIEW, PARTS, RARITY_META, dealPack, partById, type Part, type Rarity } from '@/lib/parts-drop';

type Phase = 'idle' | 'dealing' | 'picking' | 'revealed';

/** 0 = Rare, 1 = Epic, 2 = Legendary — how loud the reveal gets. */
const TIER: Record<Rarity, 0 | 1 | 2> = { Rare: 0, Epic: 1, Legendary: 2 };

/** How long the burst overlay stays mounted per rarity. */
const REVEAL_MS: Record<Rarity, number> = { Rare: 1700, Epic: 2400, Legendary: 3300 };

const PARTICLES = [
  'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9',
  'p10', 'p11', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19',
];

/** Slow gold dust that keeps drifting up after the burst — the "you won" afterglow. */
const MOTES = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'];

/* ── synthesized metal sfx (no audio files) ─────────────────────────────── */

let audioCtx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function noiseSource(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function tone(ctx: AudioContext, freq: number, at: number, duration: number, peak: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

function soundPack(on: boolean) {
  if (!on) return;
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const whoosh = noiseSource(ctx, 0.5);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass'; band.Q.value = 1.1;
  band.frequency.setValueAtTime(420, now);
  band.frequency.exponentialRampToValueAtTime(3400, now + 0.42);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 0.09);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  whoosh.connect(band).connect(gain).connect(ctx.destination);
  whoosh.start(now); whoosh.stop(now + 0.52);
  tone(ctx, 168, now, 0.28, 0.09, 'triangle');
}

function soundFlip(on: boolean, index: number) {
  if (!on) return;
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const tick = noiseSource(ctx, 0.09);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 2600;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  tick.connect(hp).connect(gain).connect(ctx.destination);
  tick.start(now); tick.stop(now + 0.1);
  tone(ctx, 1180 + index * 210, now, 0.26, 0.06, 'triangle');
}

function soundPick(on: boolean) {
  if (!on) return;
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 660, now, 0.3, 0.05);
  tone(ctx, 990, now + 0.05, 0.32, 0.04);
}

/** Tiered reveal sting: riser + sub-bass thump, arpeggio length by rarity. */
function soundReveal(rarity: Rarity, on: boolean) {
  if (!on) return;
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  if (rarity === 'Rare') {
    tone(ctx, 660, now, 0.3, 0.05);
    tone(ctx, 990, now + 0.05, 0.32, 0.04);
    tone(ctx, 1318.5, now + 0.16, 0.7, 0.03, 'triangle');
    return;
  }
  const legendary = rarity === 'Legendary';
  const riser = noiseSource(ctx, 0.75);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass'; band.Q.value = 1.3;
  band.frequency.setValueAtTime(560, now);
  band.frequency.exponentialRampToValueAtTime(legendary ? 6200 : 3600, now + 0.55);
  const riserGain = ctx.createGain();
  riserGain.gain.setValueAtTime(0.0001, now);
  riserGain.gain.linearRampToValueAtTime(legendary ? 0.13 : 0.09, now + 0.32);
  riserGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.92);
  riser.connect(band).connect(riserGain).connect(ctx.destination);
  riser.start(now); riser.stop(now + 0.95);
  tone(ctx, legendary ? 55 : 82, now + 0.02, 0.9, 0.13, 'sine');
  if (legendary) tone(ctx, 110, now + 0.06, 0.7, 0.07, 'sine');
  const notes = legendary ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => tone(ctx, freq, now + i * 0.08, (legendary ? 1.7 : 1.2) - i * 0.1, 0.07, 'sine'));

  // 落锤：riser 峰值(0.3s)那一刻的金属撞击 + 高八度钟声，和白色爆闪/卡面冲击同帧
  const clang = noiseSource(ctx, 0.5);
  const clangBand = ctx.createBiquadFilter();
  clangBand.type = 'bandpass'; clangBand.Q.value = 6;
  clangBand.frequency.setValueAtTime(legendary ? 2600 : 1900, now + 0.3);
  clangBand.frequency.exponentialRampToValueAtTime(legendary ? 900 : 700, now + 0.62);
  const clangGain = ctx.createGain();
  clangGain.gain.setValueAtTime(0.0001, now + 0.3);
  clangGain.gain.linearRampToValueAtTime(legendary ? 0.15 : 0.1, now + 0.315);
  clangGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
  clang.connect(clangBand).connect(clangGain).connect(ctx.destination);
  clang.start(now + 0.3); clang.stop(now + 0.8);
  tone(ctx, legendary ? 1568 : 1174.7, now + 0.31, legendary ? 1.8 : 1.2, 0.05, 'triangle');
  if (legendary) tone(ctx, 2349.3, now + 0.35, 1.6, 0.035, 'triangle');
  if (!legendary) return;
  // Legendary：金粉尾音拉长到 1.6s
  const shimmer = noiseSource(ctx, 1.6);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 4200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.22);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
  shimmer.connect(hp).connect(gain).connect(ctx.destination);
  shimmer.start(now); shimmer.stop(now + 1.6);
}

/* ── component ─────────────────────────────────────────────────────────── */

export function PartsPackPanel({ collection, installed, onCollect, onInstall, onClear }: {
  collection: string[];
  installed: string | null;
  onCollect: (id: string) => void;
  onInstall: (id: string) => void;
  /** 清空收藏（演示重置）：面板内部状态一并回到 idle，避免结果区停在已清掉的卡上。 */
  onClear: () => void;
}) {
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pack, setPack] = useState<Part[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([false, false, false]);
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ rarity: Rarity; x: number; y: number; id: number } | null>(null);
  const [pickedNew, setPickedNew] = useState(true);
  const [dealId, setDealId] = useState(0);
  const timers = useRef<number[]>([]);
  const reduce = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const revealSeq = useRef(0);

  useEffect(() => {
    reduce.current = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);

  const defer = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const openPack = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const cards = dealPack(collection, 3);
    const quick = reduce.current;
    setPack(cards);
    setFlipped(cards.map(() => false));
    setPicked(null);
    setReveal(null);
    setDealId(id => id + 1);
    setPhase('dealing');
    soundPack(soundRef.current);
    const step = quick ? 60 : 430;
    cards.forEach((_, index) => {
      defer(() => {
        setFlipped(prev => { const next = [...prev]; next[index] = true; return next; });
        soundFlip(soundRef.current, index);
      }, (quick ? 40 : 520) + index * step);
    });
    defer(() => setPhase('picking'), (quick ? 120 : 520) + (cards.length - 1) * step + (quick ? 80 : 560));
  }, [collection, defer]);

  const choose = useCallback((part: Part, card: HTMLElement | null) => {
    if (phase !== 'picking') return;
    setPicked(part.id);
    setPickedNew(!collection.includes(part.id));
    setPhase('revealed');
    onCollect(part.id);
    const stage = stageRef.current;
    if (stage && card) {
      // 爆闪层现在挂在 .pack-panel 的裁剪宿主里（舞台只有 201px 高会把它裁成一条带），
      // 所以爆闪坐标也要相对面板计算，而不是相对舞台。
      const box = (panelRef.current ?? stage).getBoundingClientRect();
      const face = card.getBoundingClientRect();
      revealSeq.current += 1;
      setReveal({
        rarity: part.rarity,
        x: face.left + face.width / 2 - box.left,
        y: face.top + face.height * 0.42 - box.top,
        id: revealSeq.current,
      });
    }
    soundReveal(part.rarity, soundRef.current);
    defer(() => setReveal(null), reduce.current ? 600 : REVEAL_MS[part.rarity]);
  }, [phase, collection, onCollect, defer]);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('idle');
    setPack([]);
    setFlipped([false, false, false]);
    setPicked(null);
    setReveal(null);
    onClear();
  }, [onClear]);

  const pickedPart = partById(picked);
  const busy = phase === 'dealing';
  const shown = phase === 'idle' ? [] : pack;

  return <div className="pack-panel" ref={panelRef}>
    {reveal && <div className={`pack-veil tier-${TIER[reveal.rarity]}`} aria-hidden="true" />}
    {reveal && TIER[reveal.rarity] === 2 && <div className="pack-flash" aria-hidden="true" />}

    <div className="pack-head">
      <div className="pack-count">
        <p className="eyebrow">MY COLLECTION</p>
        <strong>{collection.length}<span> / {PARTS.length} PARTS</span></strong>
      </div>
      <button className="icon-button" aria-label={soundOn ? '关闭音效' : '开启音效'}
        aria-pressed={soundOn}
        onClick={() => { const next = !soundOn; setSoundOn(next); soundRef.current = next; if (next) soundPick(true); }}>
        {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </button>
    </div>

    <div className="pack-stage" data-phase={phase} ref={stageRef}>
      {phase === 'idle' ? <div className="pack-idle">
        <div className="pack-deck" aria-hidden="true">
          <span className="pack-deck-layer layer-3" />
          <span className="pack-deck-layer layer-2" />
          <span className="pack-deck-layer layer-1" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pack-deck-back" src={CARD_BACK} alt="" width={600} height={800} />
        </div>
        <p className="pack-pitch"><strong>3 CARDS. 1 CHOICE.</strong>打开零件包，从三张卡中挑选一张，永久收藏进车库。</p>
        <button className="primary-button pack-open" onClick={openPack}><Sparkles size={15} /> OPEN PACK</button>
        <p className="fine-print">抽到的零件进入车库收藏，可以随时装到你的 911 上（演示）。</p>
      </div> : <div className={`pack-row${busy ? ' is-dealing' : ''}`} role="group" aria-label="待选择的零件卡">
        {shown.map((part, index) => <button
          key={`${dealId}-${index}`}
          type="button"
          className={`pack-card rarity-${part.rarity.toLowerCase()}${flipped[index] ? ' is-flipped' : ''}${picked === part.id ? ' is-picked' : ''}${picked && picked !== part.id ? ' is-dimmed' : ''}`}
          style={{ animationDelay: `${index * 110}ms` }}
          aria-label={flipped[index] ? `${part.name}，${RARITY_META[part.rarity].cn}` : '未翻开的零件卡'}
          disabled={phase !== 'picking'}
          onClick={(event) => choose(part, event.currentTarget)}>
          <span className="pack-card-inner">
            <span className="pack-face pack-face-back">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARD_BACK} alt="" width={600} height={800} />
            </span>
            <span className={`pack-face pack-face-front rarity-${part.rarity.toLowerCase()}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={part.image} alt={`${part.category} ${part.name} ${part.subtitle}`} width={600} height={800} />
              {picked === part.id && reveal && <>
                <span className="pack-beam" aria-hidden="true" />
                <span className={`pack-stamp tier-${TIER[part.rarity]}`} aria-hidden="true">{RARITY_META[part.rarity].label}</span>
              </>}
            </span>
          </span>
        </button>)}
      </div>}
      {reveal && TIER[reveal.rarity] >= 1 && <div className={`pack-vig tier-${TIER[reveal.rarity]}`} aria-hidden="true" />}
      {phase === 'picking' && <p className="pack-hint"><strong>TAP A CARD</strong> 从三张里挑一张，收进车库</p>}
    </div>
    {phase === 'revealed' && pickedPart && <div className={`pack-result rarity-${pickedPart.rarity.toLowerCase()}${pickedNew ? '' : ' is-dup'}`}>
      <p className="pack-result-head"><Check size={13} /> {pickedNew ? 'ADDED TO GARAGE' : 'ALREADY IN GARAGE · 重复零件'}</p>
      <p className="pack-result-name"><strong>{pickedPart.name}</strong><span>{pickedPart.subtitle} · {pickedPart.cn} · {pickedPart.code}</span></p>
      <div className="pack-result-actions">
        <button className="primary-button" disabled={installed === pickedPart.id} onClick={() => onInstall(pickedPart.id)}>
          {installed === pickedPart.id ? <><Check size={15} /> 已装入 911</> : <><Wrench size={15} /> INSTALL PART</>}
        </button>
        <button className="text-button" onClick={openPack}><RotateCcw size={13} /> OPEN ANOTHER PACK</button>
        {/* 彩蛋：只有当次抽到的是 engine（Legendary 那张）才出现 —— 打开同级项目 exploded-view-studio 的发动机 3D 拆分 */}
        {pickedPart.id === 'engine' && <a className="text-button pack-egg" href={ENGINE_EXPLODED_VIEW} target="_blank" rel="noreferrer">
          <Egg size={13} /> 我是彩蛋
        </a>}
      </div>
    </div>}

    <div className="pack-garage">
      <div className="pack-garage-head"><span className="eyebrow">GARAGE · 零件收藏</span>
        {collection.length > 0 && <button type="button" className="pack-reset" onClick={clear}><RotateCcw size={12} /> 清空收藏</button>}
        <span>{collection.length} / {PARTS.length}</span></div>
      <div className="pack-garage-grid">
        {PARTS.map(part => {
          const owned = collection.includes(part.id);
          return <div key={part.id}
            className={`pack-slot rarity-${part.rarity.toLowerCase()}${owned ? ' is-owned' : ''}${installed === part.id ? ' is-installed' : ''}`}
            title={owned ? `${part.name} · ${part.subtitle} · ${part.cn}` : '尚未收集'}>
            {owned
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={part.image} alt={part.name} width={600} height={800} />
              : <span className="pack-slot-lock" aria-hidden="true">?</span>}
            <span className="pack-slot-name">{owned ? part.name : '——'}</span>
            {installed === part.id && <span className="pack-slot-badge">已装车</span>}
          </div>;
        })}
      </div>
    </div>

    {/* 爆闪层宿主：.pack-stage 只有 656x201，会把光环/光扇/冲击波裁成一条带；
        而 .modal.pack-modal 是 overflow:auto 的滚动容器，爆闪直接溢出会撑出滚动条。
        所以挂在面板级、inset:0 + overflow:hidden 的宿主里 —— 裁剪框 = 整个弹窗面板，
        既放得下全套演出，又不会改动 .modal 的滚动高度。坐标在 choose() 里按面板算。 */}
    <div className="pack-fx" aria-hidden="true">
      {reveal && <div
        key={`burst-${reveal.id}`}
        className={`pack-burst tier-${TIER[reveal.rarity]} rarity-${reveal.rarity.toLowerCase()}`}
        style={{ left: `${reveal.x}px`, top: `${reveal.y}px` }}>
        <span className="pack-halo" />
        <span className="pack-impact" />
        {TIER[reveal.rarity] >= 1 && <span className="pack-column" />}
        {TIER[reveal.rarity] >= 1 && <span className="pack-burst-rays" />}
        {TIER[reveal.rarity] === 2 && <span className="pack-burst-rays rays-b" />}
        {TIER[reveal.rarity] === 2 && <span className="pack-burst-flare" />}
        <span className="pack-burst-ring ring-a" />
        <span className="pack-burst-ring ring-b" />
        {TIER[reveal.rarity] >= 1 && <span className="pack-burst-ring ring-c" />}
        {PARTICLES.map(name => <span key={name} className={`pack-particle ${name}`} />)}
        {TIER[reveal.rarity] >= 1 && MOTES.map(name => <span key={name} className={`pack-mote ${name}`} />)}
      </div>}
    </div>
  </div>;
}

export default PartsPackPanel;
