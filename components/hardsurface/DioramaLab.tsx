'use client';

/* eslint-disable react-hooks/immutability -- React Three Fiber integration: useThree() hands back the
   imperative Three.js renderer and scene graph, and this component's whole job is to drive them
   (background, fog, environment, shadow atlas, pointer cursor, projected DOM labels) inside effects
   and per frame. None of these are React state; they are engine objects the React Compiler does not own. */

// Interactive preview of the industrial hard-surface diorama.
// React Three Fiber owns the canvas; every piece of geometry comes from lib/hardsurface.
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, OrbitControls, useTexture } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildDiorama, type Diorama, type ModuleHandle } from '@/lib/hardsurface/diorama';
import { LABELS, LAMPS } from '@/lib/hardsurface/structures';
import { CAR } from '@/lib/hardsurface/vehicle';
import { CARD_BACK, PARTS, type Part } from '@/lib/parts-drop';

const HOME_CAMERA = new THREE.Vector3(13.6, 9.6, 14.8);
const HOME_TARGET = new THREE.Vector3(0, 0.9, 0);
const DARK = '#05070b';

// 慕尼黑车友家：悬浮在车顶上方的零件卡（访客可以「偷走」的那张）。
const CARD_Y = 2.28;
const CARD_SIZE: [number, number] = [0.86, 1.15];

type Stage = 'boot' | 'ready';

type Focus = {
  active: boolean;
  time: number;
  duration: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
};

type Ui = {
  host: React.RefObject<HTMLDivElement | null>;
  perf: React.RefObject<HTMLSpanElement | null>;
  chips: React.RefObject<Record<string, HTMLDivElement | null>>;
};

function moduleFrom(object: THREE.Object3D, diorama: Diorama): ModuleHandle | null {
  let node: THREE.Object3D | null = object;
  while (node) {
    const id = node.userData ? (node.userData.moduleId as string | undefined) : undefined;
    if (id) return diorama.byId.get(id) ?? null;
    node = node.parent;
  }
  return null;
}

export default function DioramaLab({ embedded = false, active = true, onReady, onPostcard, parts = [], onSteal }: {
  embedded?: boolean;
  active?: boolean;
  onReady?: () => void;
  onPostcard?: () => void;
  /** 已收集的零件 id —— 决定车顶上那张卡发的是哪一张。 */
  parts?: string[];
  /** 点中那张卡 = 偷走。 */
  onSteal?: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>('boot');
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [explode, setExplode] = useState(0);
  const [labels, setLabels] = useState(!embedded);
  const [spin, setSpin] = useState(!embedded);
  const [lamps, setLamps] = useState<boolean[]>(() => LAMPS.map((lamp) => !embedded && lamp.live));
  const [info, setInfo] = useState<ModuleHandle | null>(null);
  const [stolen, setStolen] = useState(false);
  const stealCard = embedded && !stolen ? PARTS.find((part) => !parts.includes(part.id)) ?? PARTS[0] : null;
  const steal = () => {
    if (!stealCard) return;
    setStolen(true);
    onSteal?.(stealCard.id);
  };

  const host = useRef<HTMLDivElement | null>(null);
  const perf = useRef<HTMLSpanElement | null>(null);
  const chips = useRef<Record<string, HTMLDivElement | null>>({});
  const ui = useMemo<Ui>(() => ({ host, perf, chips }), []);

  // Defer the mount flag by one frame so the effect never sets state synchronously
  // (same idiom as components/SceneLoading.tsx). Canvas only exists on the client.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (stage === 'ready') onReady?.();
  }, [stage, onReady]);

  const onHover = useCallback((handle: ModuleHandle | null) => {
    const id = handle ? handle.id : null;
    setHovered((current) => (current === id ? current : id));
  }, []);

  const clear = useCallback(() => {
    setSelected(null);
    setInfo(null);
  }, []);

  const onSelect = useCallback((handle: ModuleHandle | null) => {
    setSelected(handle ? handle.id : null);
    setInfo(handle);
    const index = handle ? handle.lampIndex : undefined;
    if (index !== undefined) {
      setLamps((current) => current.map((on, i) => (i === index ? !on : on)));
    }
  }, []);

  return (
    <div
      ref={host}
      className={`hs-stage${embedded ? " hs-home" : ""}`}
      data-stage={stage}
      data-hover={hovered ?? ''}
      data-selected={selected ?? ''}
      data-explode={explode.toFixed(2)}
      data-parts=""
      data-calls=""
      data-tris=""
      data-modules=""
    >
      {mounted ? (
        <Canvas
          flat={!embedded}
          frameloop={embedded ? "demand" : "always"}
          shadows="soft"
          dpr={[1, 1.5]}
          gl={{ antialias: embedded, powerPreference: 'high-performance', stencil: false }}
          camera={{ fov: 32, near: 0.2, far: 140, position: HOME_CAMERA.toArray() }}
          onPointerMissed={clear}
        >
          <Scene
            embedded={embedded}
            stage={stage}
            setStage={setStage}
            hovered={hovered}
            selected={selected}
            explode={explode}
            labels={labels}
            spin={spin && active}
            pauseSpin={() => setSpin(false)}
            lamps={lamps}
            onHover={onHover}
            onSelect={onSelect}
            ui={ui}
            stealCard={stealCard}
            onSteal={steal}
          />
        </Canvas>
      ) : null}

      {!embedded && <>
      <div className="hs-panel hs-tl">
        <div className="hs-badge">SELENE // SITE 07</div>
        <div className="hs-sub">工业硬表面质感样片 · Phase 1</div>
        <div className="hs-hint">平台结构 · 主穹顶 · 作业照明 · 场地设施 · 车辆总成</div>
        <Link href="/" className="hs-back">← 返回保时捷之家</Link>
      </div>

      <div className="hs-panel hs-tr">
        <span ref={perf} className="hs-perf">—</span>
        <div className="hs-hint">{hovered ? `悬停 ${hovered}` : '待机'}</div>
        <div className="hs-hint">{selected ? `选中 ${selected}` : ''}</div>
      </div>

      </>}

      {labels
        ? LABELS.map((label) => (
            <div
              key={label.id}
              className="hs-label"
              ref={(node) => {
                chips.current[label.id] = node;
              }}
            >
              <span className="hs-label-title">{label.title}</span>
              <span className="hs-label-sub">{label.sub}</span>
            </div>
          ))
        : null}

      {!embedded && <div className="hs-panel hs-controls">
        <label className="hs-slider">
          <span>爆炸视图</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(explode * 100)}
            onChange={(event) => setExplode(Number(event.target.value) / 100)}
          />
          <span className="hs-value">{Math.round(explode * 100)}%</span>
        </label>
        <div className="hs-buttons">
          <button type="button" onClick={() => setExplode(1)}>拆解</button>
          <button type="button" onClick={() => setExplode(0)}>合拢</button>
          <button type="button" onClick={() => setSpin((value) => !value)} data-active={spin}>
            {spin ? '转台 开' : '转台 关'}
          </button>
          <button type="button" onClick={() => setLabels((value) => !value)} data-active={labels}>
            {labels ? '标签 开' : '标签 关'}
          </button>
        </div>
        <div className="hs-lamps">
          {LAMPS.map((lamp, index) => (
            <button
              key={lamp.id}
              type="button"
              className="hs-lamp"
              data-on={lamps[index] ? 'on' : 'off'}
              onClick={() => setLamps((current) => current.map((on, i) => (i === index ? !on : on)))}
            >
              {`L${index + 1}`}
            </button>
          ))}
        </div>
      </div>}

      {embedded && <div className="hs-home-controls" role="group" aria-label="探索慕尼黑车友之家">
        <button type="button" aria-pressed={!selected} onClick={clear}>全景</button>
        <button type="button" aria-pressed={selected === 'dome-shell'} onClick={() => { setSelected('dome-shell'); setInfo(null); }}>穹顶之家</button>
        <button type="button" aria-pressed={selected === 'vehicle-body'} onClick={() => { setSelected('vehicle-body'); setInfo(null); }}>看看爱车</button>
        <button type="button" aria-pressed={lamps.some(Boolean)} onClick={() => setLamps(LAMPS.map(() => !lamps.some(Boolean)))}>{lamps.some(Boolean) ? '熄灯' : '亮灯'}</button>
        {stealCard && <button type="button" onClick={steal}>偷张卡</button>}
        <button type="button" onClick={onPostcard}>留张明信片</button>
      </div>}

      {!embedded && info ? (
        <div className="hs-panel hs-info">
          <div className="hs-info-head">
            <span className="hs-info-name">{info.name}</span>
            <button type="button" className="hs-close" onClick={clear}>×</button>
          </div>
          <div className="hs-info-row"><span>编号</span><b>{info.id}</b></div>
          <div className="hs-info-row"><span>所属</span><b>{info.sectionLabel}</b></div>
          <div className="hs-info-row"><span>通道</span><b>{info.channel}</b></div>
          <div className="hs-info-row"><span>外包尺寸</span><b>{info.size.map((value) => value.toFixed(2)).join(' × ')} m</b></div>
          <div className="hs-info-row"><span>零件</span><b>{info.parts}</b></div>
          <div className="hs-info-row"><span>材质</span><b>{info.materials.join(' / ')}</b></div>
          <div className="hs-info-note">{info.note}</div>
        </div>
      ) : null}

      {!embedded && <div className="hs-panel hs-help">
        拖动旋转 · 滚轮缩放 · 悬停高亮 · 点击选中 / 拨动灯柱 · 点空白处取消
      </div>}

      {stage === 'boot' && !embedded ? (
        <div className="hs-veil">
          <div className="hs-veil-text">正在装载 SITE 07 场景…</div>
        </div>
      ) : null}
    </div>
  );
}

type SceneProps = {
  embedded: boolean;
  stage: Stage;
  setStage: (stage: Stage) => void;
  hovered: string | null;
  selected: string | null;
  explode: number;
  labels: boolean;
  spin: boolean;
  pauseSpin: () => void;
  lamps: boolean[];
  onHover: (handle: ModuleHandle | null) => void;
  onSelect: (handle: ModuleHandle | null) => void;
  ui: Ui;
  stealCard: Part | null;
  onSteal: () => void;
};

function Scene(props: SceneProps) {
  const diorama = useMemo(() => buildDiorama(), []);
  const stealCard = props.stealCard;
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  const explodeValue = useRef(0);
  const shadowFrames = useRef(4);
  const lampTargets = useRef<number[]>(LAMPS.map((lamp) => (lamp.live ? 1 : 0)));
  const fps = useRef(60);
  const tick = useRef(-1);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const focus = useRef<Focus>({
    active: false, time: 0, duration: 0.9,
    fromPosition: new THREE.Vector3(), toPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3(),
  });

  useEffect(() => {
    if (!props.embedded || !(camera instanceof THREE.PerspectiveCamera)) return;
    // Keep the whole platform in view on portrait screens.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(16)) / Math.min(1, size.width / size.height)));
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, props.embedded, invalidate]);

  // The visitor scene uses daylight; the standalone material lab keeps its night lighting.
  useEffect(() => {
    const previousBackground = scene.background;
    const previousFog = scene.fog;
    const background = props.embedded ? '#dce5eb' : DARK;
    scene.background = new THREE.Color(background);
    scene.fog = new THREE.Fog(background, 22, 58);
    if (props.embedded) {
      const paint = diorama.materials.carPaint as THREE.MeshPhysicalMaterial;
      paint.color.set('#101216');
      paint.roughness = 0.22;
      paint.envMapIntensity = 1.25;
      diorama.lights.key.intensity = 3.5;
      diorama.lights.hemi.color.set('#d8eaff');
      diorama.lights.hemi.groundColor.set('#9b988c');
      diorama.lights.hemi.intensity = 1.8;
      diorama.lights.rim.intensity = 1.2;
      diorama.lamps.forEach((lamp) => { lamp.intensity.value = 0; });
      diorama.applyLampIntensities();
    }
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = props.embedded ? 0.85 : 0.42;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      environment.dispose();
      scene.background = previousBackground;
      scene.fog = previousFog;
    };
  }, [gl, scene, diorama, props.embedded]);

  // static scene ⇒ render the shadow atlas a few times, then freeze it
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      diorama.dispose();
    };
  }, [gl, diorama]);

  useEffect(() => {
    lampTargets.current = props.lamps.map((on) => (on ? 1 : 0));
    invalidate();
  }, [props.lamps, invalidate]);

  // outline + cursor follow hover / selection
  useEffect(() => {
    const hovered = props.hovered ? diorama.byId.get(props.hovered) ?? null : null;
    const selected = props.selected ? diorama.byId.get(props.selected) ?? null : null;
    const target = hovered ?? selected;
    diorama.outlineFor(target, Boolean(selected && target && selected.id === target.id));
    gl.domElement.style.cursor = hovered ? 'pointer' : 'default';
    invalidate();
  }, [props.hovered, props.selected, diorama, gl, invalidate]);

  // select a part ⇒ glide the camera onto it; deselect ⇒ glide home
  useEffect(() => {
    const state = focus.current;
    const handle = props.selected ? diorama.byId.get(props.selected) ?? null : null;
    state.fromPosition.copy(camera.position);
    state.fromTarget.copy(controls.current ? controls.current.target : HOME_TARGET);
    if (handle) {
      const radius = Math.max(handle.size[0], handle.size[1], handle.size[2]) * 0.5;
      const half = THREE.MathUtils.degToRad(32) * 0.5;
      const distance = THREE.MathUtils.clamp((radius / Math.tan(half)) * 1.55, 6, 22);
      const direction = camera.position.clone().sub(handle.centre);
      direction.y = Math.max(direction.y, 2.6);
      direction.normalize();
      state.toPosition.copy(handle.centre).addScaledVector(direction, distance);
      state.toTarget.copy(handle.centre);
    } else {
      state.toPosition.copy(HOME_CAMERA);
      state.toTarget.copy(HOME_TARGET);
    }
    state.time = 0;
    state.active = state.fromPosition.distanceToSquared(state.toPosition) > 0.0001 || state.fromTarget.distanceToSquared(state.toTarget) > 0.0001;
    invalidate();
  }, [props.selected, diorama, camera, invalidate]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    if (!props.embedded) diorama.update(elapsed);

    if (Math.abs(explodeValue.current - props.explode) > 0.0015) {
      explodeValue.current += (props.explode - explodeValue.current) * Math.min(1, dt * 5.5);
      for (const mod of diorama.modules) mod.group.position.copy(mod.offset).multiplyScalar(explodeValue.current);
      shadowFrames.current = 4;
    }
    if (shadowFrames.current > 0) {
      shadowFrames.current -= 1;
      gl.shadowMap.needsUpdate = true;
    }

    let lampsChanged = false;
    diorama.lamps.forEach((lamp, index) => {
      const goal = lampTargets.current[index] ?? 0;
      const value = lamp.intensity.value;
      if (Math.abs(value - goal) > 0.002) {
        lamp.intensity.value = value + (goal - value) * Math.min(1, dt * 4.5);
        lampsChanged = true;
      }
    });
    if (lampsChanged) diorama.applyLampIntensities();

    const glide = focus.current;
    if (glide.active) {
      glide.time += dt;
      const t = Math.min(1, glide.time / glide.duration);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(glide.fromPosition, glide.toPosition, ease);
      scratch.lerpVectors(glide.fromTarget, glide.toTarget, ease);
      if (controls.current) controls.current.target.copy(scratch);
      if (t >= 1) glide.active = false;
    }
    if (controls.current) controls.current.autoRotate = props.spin && !glide.active;

    if (props.labels) {
      for (const label of diorama.labels) {
        const node = props.ui.chips.current[label.id];
        if (!node) continue;
        scratch.set(label.anchor[0], label.anchor[1], label.anchor[2]).project(camera);
        const x = (scratch.x * 0.5 + 0.5) * size.width;
        const y = (-scratch.y * 0.5 + 0.5) * size.height;
        node.style.transform = `translate3d(${(x + 14).toFixed(1)}px, ${(y - 26).toFixed(1)}px, 0)`;
        node.style.opacity = scratch.z > -1 && scratch.z < 1 ? '1' : '0';
      }
    }

    fps.current = fps.current * 0.92 + (1 / Math.max(dt, 0.0001)) * 0.08;
    const stamp = Math.floor(elapsed * 4);
    if (stamp !== tick.current) {
      tick.current = stamp;
      const host = props.ui.host.current;
      // gl.info.render.calls would report only the composer's final full-screen pass (1), so use
      // the scene's own mesh count instead.
      const calls = diorama.stats.drawCalls;
      const triangles = Math.round(diorama.stats.triangles);
      if (props.ui.perf.current) {
        props.ui.perf.current.textContent = `${calls} draw · ${(triangles / 1000).toFixed(0)}k tris · ${Math.round(fps.current)} fps`;
      }
      if (host) {
        host.dataset.calls = String(calls);
        host.dataset.tris = String(triangles);
        host.dataset.parts = String(diorama.stats.parts);
        host.dataset.modules = String(diorama.modules.length);
        host.dataset.hover = props.hovered ?? '';
        host.dataset.steal = stealCard ? stealCard.id : '';
      }
    }
    if (props.embedded && (glide.active || lampsChanged || shadowFrames.current > 0)) invalidate();
    if (props.stage !== 'ready') props.setStage('ready');
  });

  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    const pause = () => {
      focus.current.active = false;
      props.pauseSpin();
    };
    instance.addEventListener('start', pause);
    return () => instance.removeEventListener('start', pause);
  }, [props]);

  const over = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    props.onHover(moduleFrom(event.object, diorama));
  };

  return (
    <>
      <primitive
        object={diorama.root}
        onPointerOver={over}
        onPointerOut={() => props.onHover(null)}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 6) return;
          event.stopPropagation();
          props.onSelect(moduleFrom(event.object, diorama));
        }}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        enablePan={false}
        minDistance={7}
        maxDistance={42}
        minPolarAngle={0.2}
        maxPolarAngle={1.45}
        target={HOME_TARGET.toArray()}
        autoRotateSpeed={0.42}
      />
      {stealCard ? (
        <Suspense fallback={null}>
          <StealCard
            onStolen={props.onSteal}
          />
        </Suspense>
      ) : null}
      {!props.embedded && <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.86} luminanceSmoothing={0.2} intensity={props.embedded ? 0.18 : 0.6} radius={0.72} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>}
    </>
  );
}

// Only show the back until claimed; a static billboard also lets the scene rest.
function StealCard({ onStolen }: { onStolen: () => void }) {
  const gl = useThree((state) => state.gl);
  const [hovered, setHovered] = useState(false);
  const back = useTexture(CARD_BACK);
  const leave = () => {
    setHovered(false);
    gl.domElement.style.cursor = 'default';
  };
  return (
    <Billboard position={[CAR.x, CARD_Y, CAR.z]}>
      <mesh
        scale={hovered ? 1.07 : 1}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHovered(true);
          gl.domElement.style.cursor = 'pointer';
        }}
        onPointerOut={leave}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 6) return;
          event.stopPropagation();
          leave();
          onStolen();
        }}
      >
        <planeGeometry args={CARD_SIZE} />
        <meshBasicMaterial map={back} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}
