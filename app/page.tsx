"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, Home, LoaderCircle, Mail, Map as MapIcon, Moon, QrCode, PenLine, RotateCcw, Settings2, Sparkles, Sun, Sunset, Users, Wrench, X } from "lucide-react";
import dynamic from "next/dynamic";
const GardenScene = dynamic(() => import("@/components/GardenScene"), { ssr: false });
const DioramaLab = dynamic(() => import("@/components/hardsurface/DioramaLab"), { ssr: false });
import Link from "next/link";
import { workshopModels } from "@/lib/workshop-catalog";
import SceneLoading from "@/components/SceneLoading";
import { FriendsPanel, GalleryPanel, PetPanel, PhoneEntry, VehiclePanel } from "@/components/DemoPanels";
import { PartsPackPanel } from "@/components/PartsDrop";
import { PARTS, RARITY_META, clearCollection, partById, readCollection, readInstalled, writeCollection, writeInstalled } from "@/lib/parts-drop";
import { DEMO_HOME, type HomeConfig, type HomeData, type Postcard } from "@/lib/home-config";
import { getSampleHome, localRecordId, readLocal, sampleMemories, writeLocal, type Friend, type Memory, type Pet } from "@/lib/demo-world";

type ApiHome = HomeData & { authenticated: boolean; aiReady: boolean };
type ScenePlace = "entry" | "map" | "home" | "workshop" | "memories" | "terrace";
type ModalType = "story" | "edit" | "invite" | "postcards" | "phone" | "friends" | "gallery" | "vehicle" | "pet" | "pack" | "stolen" | null;
const navigationPlaces = [
  { id: "map", label: "地图", Icon: MapIcon }, { id: "home", label: "归处", Icon: Home },
  { id: "workshop", label: "车库", Icon: Wrench },
] as const;
const placeCopy: Record<ScenePlace, { eyebrow: string; title: string; lines: [string, string]; footer: string }> = {
  entry: { eyebrow: "WELCOME TO YOUR PORSCHE HOME", title: "", lines: ["沿着车道，推开属于你的世界。", "庭院、爱车与朋友，都在等你。"], footer: "00 / THE GARDEN GATE" },
  map: { eyebrow: "FRIENDS AROUND THE WORLD", title: "朋友，在世界的另一端。", lines: ["看看好友在哪里，分享今天走过的路。", "下一站，上海江桥研发中心。"], footer: "00 / THE FRIENDS MAP" },
  home: { eyebrow: "YOUR OWN LITTLE WORLD", title: "沿着热爱，去走走。", lines: ["一座家，几处风景，还有远道而来的朋友。", "点击地标，沿着小径探索你的世界。"], footer: "01 / THE COURTYARD HOME" },
  workshop: { eyebrow: "THE GARAGE", title: "热爱，由细节组成。", lines: ["让每个组件，各就其位。", "转动视角，欣赏熟悉轮廓里的每一面。"], footer: "02 / THE GARAGE" },
  memories: { eyebrow: "THE MEMORY PAVILION", title: "值得的时刻，留在这里。", lines: ["有些路，因为同行的人而难忘。", "在展亭里，读一段关于你与爱车的故事。"], footer: "03 / THE MEMORY PAVILION" },
  terrace: { eyebrow: "THE GUEST TERRACE", title: "风景正好，来坐坐吧。", lines: ["为朋友留一张椅子，也留一句想说的话。", "来过这里，就有一段共同的记忆。"], footer: "04 / THE GUEST TERRACE" },
};
const colors = [
  { label: "冰川银", value: "#b9c0ba" }, { label: "松林绿", value: "#556b58" },
  { label: "胭脂红", value: "#9d2927" }, { label: "暖砂白", value: "#e9e7dc" },
  { label: "曜石黑", value: "#252a29" }, { label: "海湾蓝", value: "#466b82" },
];
const signature = (h: HomeData) => JSON.stringify([h.title, h.ownerName, h.story, h.config]);
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, signal:options?.signal??AbortSignal.timeout(url.includes('api/design')?45000:20000), headers: { "Content-Type": "application/json", ...options?.headers } }).catch(error=>{if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new Error('连接超时，请稍后重试；当前布置仍保留在页面中。');throw error;});
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "暂时没有完成，请稍后再试。");
  return data as T;
}
function Dialog({ title, eyebrow, children, onClose, className = "" }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () => Array.from(node?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = focusable(); const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("keydown", handle); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
      <div className="modal-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={19} /></button></div>
      {children}
    </div>
  </div>;
}

export default function PorscheHome() {
  const [home, setHome] = useState<HomeData>({ ...DEMO_HOME, config: { ...DEMO_HOME.config } });
  const [aiReady, setAiReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sceneReady, setSceneReady] = useState(false);
  const [entered,setEntered]=useState(false);
  const [loadingProgress,setLoadingProgress]=useState(0);
  const [loadingStage,setLoadingStage]=useState('正在打开你的私人世界');
  const [isVisit, setIsVisit] = useState(false);
  const [view, setView] = useState<ScenePlace>("entry");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"space" | "car">("space");
  const [modal, setModal] = useState<ModalType>(null);
  const [sample, setSample] = useState<Friend | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [memories, setMemories] = useState<Memory[]>(sampleMemories);
  const [pet, setPet] = useState<Pet>({ kind: "none", name: "" });
  const [phoneUrl, setPhoneUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [designing, setDesigning] = useState(false);
  const [designResult, setDesignResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "error">("saved");
  const [notice, setNotice] = useState("");
  const [parts, setParts] = useState<string[]>([]);
  const [stolenPart, setStolenPart] = useState<string | null>(null);
  const [installedPart, setInstalledPart] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [workshopModel, setWorkshopModel] = useState(workshopModels[0]);
  const [exhibitStatus, setExhibitStatus] = useState<'loading'|'ready'|'error'>('ready');
  const [edit, setEdit] = useState({ title: "", ownerName: "", story: "" });
  const [postcard, setPostcard] = useState({ name: "", message: "", theme: "forest" });
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const savedSignature = useRef(signature(DEMO_HOME));
  const latestHome = useRef(home);
  const savePromise = useRef<Promise<HomeData> | null>(null);
  const failedSignature = useRef<string | null>(null);
  const undoConfig = useRef<HomeConfig | null>(null);
  const readOnly = isVisit || !home.isOwner;
  const dirtySignature = signature(home);
  latestHome.current = home;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("visit") || params.get("home");
    if (params.get("view") === "home") setView("home");
    if (params.get("view") === "workshop") {
      setView("workshop");
      const model = workshopModels.find(({ id }) => id === params.get("model"));
      if (model) {
        setWorkshopModel(model);
      }
    }
    setPhoneUrl(window.location.href);
    setFriends(readLocal("friends", []));
    setParts(readCollection());
    setInstalledPart(readInstalled());
    const demo = !id ? getSampleHome(params.get("demo")) : null;
    if (demo) {
      setSample(demo.friend);
      setView("home");
      setIsVisit(true);
      setPet(demo.pet);
      setHome({ ...demo.home, postcards: readLocal(`demo-postcards:${demo.friend.key}`, []) });
      setLoading(false);
      return;
    }
    if (!id && !params.has("visit")) {
      setMemories(readLocal("memories", sampleMemories));
      setPet(readLocal("pet", { kind: "none", name: "" }));
    }
    setIsVisit(params.has("visit"));
    api<ApiHome>(`api/home${id ? `?id=${encodeURIComponent(id)}` : ""}`)
      .then((data) => {
        if (cancelled) return;
        savedSignature.current = signature(data);
        setHome(data); setAiReady(Boolean(data.aiReady));
      })
      .catch((error) => { if (!cancelled) setLoadError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (sceneReady && !loading) setEntered(true); }, [sceneReady, loading]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(id); }, [notice]);
  const closeModal = useCallback(() => { setModal(null); setPostError(""); }, []);
  const selectPlace = useCallback((place: ScenePlace) => {
    setView(place); setModal(null);
    if (place !== "home") setPanelOpen(false);
  }, []);
  const showNotice = (message: string) => setNotice(message);
  const collectPart = (id: string, origin?: string) => {
    const info = partById(id);
    if (parts.includes(id)) { showNotice(`${info?.name ?? "这个零件"} 已经在你的车库里了。`); return; }
    const next = [...parts, id];
    if (!writeCollection(next)) { showNotice("浏览器未能保存这次收藏。"); return; }
    setParts(next);
    const card = info ? `${info.name} · ${info.cn}` : "零件";
    showNotice(origin ? `${origin} ${card} 已收进车库。` : `${card} 已收进车库。`);
  };
  const installPart = (id: string) => {
    if (!writeInstalled(id)) { showNotice("浏览器未能保存装配记录。"); return; }
    setInstalledPart(id);
    const info = partById(id);
    showNotice(`${info?.name ?? "零件"} 已装到你的 911 上（演示）。`);
  };
  const clearParts = () => {
    if (!clearCollection()) { showNotice("浏览器未能清空收藏。"); return; }
    setParts([]);
    setInstalledPart(null);
    showNotice("零件收藏已清空，可以重新开包了。");
  };
  const persist = useCallback(async (): Promise<HomeData> => {
    if (savePromise.current) return savePromise.current;
    const draft = latestHome.current;
    if (readOnly) return draft;
    const draftSignature = signature(draft);
    setSaving(true);
    const task = api<ApiHome>("api/home", { method: "POST", body: JSON.stringify({ id: draft.id, title: draft.title, ownerName: draft.ownerName, story: draft.story, config: draft.config }) })
      .then((data) => {
        savedSignature.current = draftSignature;
        failedSignature.current = null;
        setHome((current) => ({ ...current, id: data.id, isOwner: data.isOwner, updatedAt: data.updatedAt, postcards: data.postcards || current.postcards }));
        setSaveState(signature(latestHome.current) === draftSignature ? "saved" : "dirty");
        return { ...draft, ...data };
      })
      .catch((error) => { failedSignature.current = draftSignature; setSaveState("error"); throw error; })
      .finally(() => { setSaving(false); savePromise.current = null; });
    savePromise.current = task;
    return task;
  }, [readOnly]);
  useEffect(() => {
    if (loading || readOnly || saving) return;
    const dirty = dirtySignature !== savedSignature.current;
    if (!dirty) return;
    if (dirtySignature === failedSignature.current) return;
    setSaveState("dirty");
    if (!home.id) return;
    const timer = window.setTimeout(() => { persist().catch((error) => showNotice(error.message)); }, 1400);
    return () => window.clearTimeout(timer);
  }, [dirtySignature, home.id, loading, readOnly, persist, saving]);
  const changeConfig = <K extends keyof HomeConfig>(key: K, value: HomeConfig[K]) => {
    if (readOnly) return;
    setHome((current) => ({ ...current, config: { ...current.config, [key]: value } }));
  };
  const applyDesign = async () => {
    if (!prompt.trim() || designing || readOnly) return;
    setDesigning(true); setDesignResult("");
    try {
      const result = await api<{ config: HomeConfig; summary: string; mode: "ai" | "basic"; aiReady: boolean }>("api/design", { method: "POST", body: JSON.stringify({ prompt: prompt.trim(), config: home.config }) });
      undoConfig.current = { ...home.config };
      setHome((current) => ({ ...current, config: result.config }));
      setAiReady(result.aiReady); setDesignResult(result.summary);
    } catch (error) { setDesignResult(error instanceof Error ? error.message : "布置暂时没有完成，请再试一次。"); }
    finally { setDesigning(false); }
  };
  const share = async () => {
    if (sample) { setInviteUrl(new URL(sample.href, window.location.href).href); setCopied(false); setModal("invite"); return; }
    try {
      const data = readOnly && home.id ? home : await persist();
      if (!data.id) throw new Error("请先保存空间，再创建拜访链接。");
      setInviteUrl(`${window.location.origin}${window.location.pathname}?visit=${encodeURIComponent(data.id)}`); setCopied(false); setModal("invite");
    } catch (error) { showNotice(error instanceof Error ? error.message : "暂时无法生成链接。"); }
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); showNotice("拜访链接已复制。"); }
    catch { showNotice("请长按或选中链接，手动复制。"); }
  };
  const openEdit = () => { setEdit({ title: home.title, ownerName: home.ownerName, story: home.story }); setModal("edit"); };
  const toggleFriend = (friend: Friend) => {
    const next = friends.some(item => item.key === friend.key)
      ? friends.filter(item => item.key !== friend.key)
      : [...friends, friend];
    setFriends(next);
    if (!writeLocal("friends", next)) showNotice("浏览器未能保存好友列表。");
  };
  const sendPostcard = async () => {
    setPostError("");
    if (!postcard.name.trim() || !postcard.message.trim()) { setPostError("请写上你的名字和想留下的话。"); return; }
    if (sample) {
      const card: Postcard = { id: localRecordId(), name: postcard.name.trim(), message: postcard.message.trim(), theme: postcard.theme, createdAt: Date.now() };
      const next = [card, ...home.postcards];
      if (!writeLocal(`demo-postcards:${sample.key}`, next)) { setPostError("浏览器未能保存这张演示明信片。"); return; }
      setHome(current => ({ ...current, postcards: next }));
      setPostcard(current => ({ ...current, message: "" }));
      showNotice("演示明信片已留在这座家里。");
      return;
    }
    if (!home.id) { setPostError("这个空间还未保存。主人保存后，就可以收到明信片了。"); return; }
    setPosting(true);
    try {
      const response = await api<{ postcard: Postcard }>("api/postcards", { method: "POST", body: JSON.stringify({ homeId: home.id, name: postcard.name.trim(), message: postcard.message.trim(), theme: postcard.theme }) });
      setHome((current) => ({ ...current, postcards: [response.postcard, ...current.postcards] }));
      setPostcard((current) => ({ ...current, message: "" })); showNotice("明信片已送达，感谢你的来访。");
    } catch (error) { setPostError(error instanceof Error ? error.message : "明信片暂时未送达，请稍后重试。"); }
    finally { setPosting(false); }
  };
  const currentFriend = sample ?? (readOnly && home.id
    ? { key: home.id, name: home.ownerName, title: home.title, region: "车友庭院", href: `./?visit=${encodeURIComponent(home.id)}` }
    : null);
  const isMunich = sample?.key === "munich";
  const currentPlace = isMunich ? {
    eyebrow: "ALPINE SUNDAY / MUNICH",
    title: home.title,
    lines: ["把旅途停在这里，和朋友聊聊下一程。", "走近穹顶，看看爱车，留一张明信片。"],
    footer: "MUNICH / THE PRIVATE RETREAT",
  } : placeCopy[view];
  const introTitle = view === "home" && sample ? home.title : currentPlace.title;
  const timeLabel = { day: "午后", sunset: "日落", night: "夜晚" }[home.config.time];
  if (loadError) return <main className="error-page"><div className="brand-wordmark">PORSCHE HOME</div><p className="eyebrow">A PLACE TO RETURN TO</p><h1>暂时没能走进这座家。</h1><p>{loadError}</p><a className="primary-button" href="./">返回我的庭院 <ArrowRight size={16} /></a></main>;
  return <main className={`home-app time-${home.config.time} is-${view}${isMunich ? " munich-home" : ""}`}>
    <div className="world-interface" inert={!entered}>
    <div className="scene-stage" aria-label={isMunich ? "慕尼黑车友的穹顶之家，可旋转缩放并探索爱车和灯光" : sample?.key === "porsche-rd" ? "江桥研发中心庭院之家" : "可旋转和缩放的三维地图，包含庭院之家、车库、记忆展亭和来客露台"}>{!loading && (isMunich ? <DioramaLab embedded active={entered&&!modal} onReady={() => { setLoadingProgress(100); setSceneReady(true); }} onPostcard={() => setModal("postcards")} parts={parts} onSteal={(id) => { collectPart(id, "从慕尼黑之家偷到"); setStolenPart(id); setModal("stolen"); }} /> : <GardenScene config={home.config} view={view} campus={sample?.key} workshopModelId={workshopModel.id} explode={1} ownedParts={parts} onExhibitStatus={setExhibitStatus} pet={pet.kind} active={entered&&!modal} onReady={() => setSceneReady(true)} onPlaceSelect={selectPlace} onLoadingProgress={(value,stage)=>{setLoadingProgress(value);setLoadingStage(stage);if(value<100)setSceneReady(false);}} />)}</div>
    <div className="scene-vignette" aria-hidden="true" />
    <header className="site-header">
      <a className="brand" href="./" aria-label="保时捷之家首页"><span className="brand-wordmark">Porsche Home<span className="brand-dot">.</span></span><span className="brand-caption">回到热爱</span></a>
      <div className="header-actions"><button className="quiet-button prototype-header-button" aria-label="手机扫码" onClick={() => setModal("phone")}><QrCode size={16} /><span>扫码</span></button><button className="quiet-button prototype-header-button" aria-label="好友列表" onClick={() => setModal("friends")}><Users size={16} /><span>好友</span></button><span className="save-status" role="status">{saving ? <><LoaderCircle size={12} className="spin" /> 保存中</> : readOnly ? <><span className="status-dot" /> 正在做客</> : home.id && saveState === "saved" ? <><Check size={12} /> 已保存</> : saveState === "error" ? "保存失败" : home.id ? "有未保存更改" : null}</span><button className="invite-button" onClick={share} disabled={loading || saving}><span>{readOnly ? "分享这座家" : "邀请朋友"}</span><ArrowUpRight size={16} /></button></div>
    </header>
    <section className="scene-intro" aria-label="空间介绍">
      <p className="eyebrow"><span className="tiny-line" />{currentPlace.eyebrow}</p>
      {introTitle && <h1>{introTitle.includes("，") ? introTitle.split("，").map((line, index) => <span key={index}>{line}{index === 0 ? "，" : ""}</span>) : introTitle}</h1>}
      <p className="intro-copy">{currentPlace.lines[0]}<br />{currentPlace.lines[1]}</p>
      {view !== "entry" && <button className="story-link" onClick={() => { if (view === "map") selectPlace("home"); else setModal(view === "terrace" ? "postcards" : "story"); }}><span>{view === "map" ? "先去家里看看" : view === "workshop" ? "关于这间车库" : view === "terrace" ? "写张明信片" : `${home.ownerName}的故事`}</span><ArrowRight size={16} /></button>}
      <div className="place-note"><span className="status-dot" /> {isMunich ? "午后" : timeLabel} · {home.config.weather === "rain" ? "细雨正好" : "天气正好"}<span className="note-divider">/</span><span>{readOnly ? "欢迎来做客" : "此刻，属于你"}</span></div>
    </section>
    {view === "home" && !panelOpen && !readOnly && <div className="design-invitation"><span className="small-orbit"><Sparkles size={18} strokeWidth={1.5} /></span><div><p>理想的家，从一句话开始。</p><span>{aiReady ? "让 AI 为你的热爱布置一个空间" : "选择风格，或用简单指令布置"}</span></div><button className="round-button" aria-label="打开空间布置面板" onClick={() => setPanelOpen(true)}><ArrowUpRight size={19} /></button></div>}
    {sample && <div className="prototype-visitor-badge">{sample.region} · {isMunich ? "穹顶之家" : sample.key.startsWith("porsche-") ? "建筑场景" : "示范庭院"}</div>}
    {panelOpen && !readOnly && <aside className="design-panel" aria-label="空间布置面板">
      <div className="panel-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h2>布置我的家</h2></div><button className="icon-button" aria-label="收起布置面板" onClick={() => setPanelOpen(false)}><X size={17} /></button></div>
      <div className="panel-tabs" role="tablist" aria-label="布置分类"><button role="tab" aria-selected={panelTab === "space"} className={panelTab === "space" ? "active" : ""} onClick={() => setPanelTab("space")}><Home size={14} /> 空间与氛围</button><button role="tab" aria-selected={panelTab === "car"} className={panelTab === "car" ? "active" : ""} onClick={() => setPanelTab("car")}><Wrench size={14} /> 我的 911</button></div>
      <div className="panel-scroll">
        {panelTab === "space" ? <>
          <fieldset className="option-group"><legend>建筑风格</legend><div className="architecture-options">{([{ value: "courtyard", title: "庭院之家", note: "石材 · 木色" }, { value: "pavilion", title: "玻璃会客厅", note: "通透 · 极简" }, { value: "alpine", title: "山间小屋", note: "温暖 · 自然" }] as const).map((option) => <button key={option.value} aria-pressed={home.config.architecture === option.value} className={`architecture-option ${home.config.architecture === option.value ? "selected" : ""}`} onClick={() => changeConfig("architecture", option.value)}><span className={`architecture-sketch ${option.value}`} aria-hidden="true"><i /><b /></span><span>{option.title}</span><small>{option.note}</small></button>)}</div></fieldset>
          <fieldset className="option-group"><legend>光线与天气</legend><div className="time-options">{([{ value: "day", label: "午后", Icon: Sun }, { value: "sunset", label: "日落", Icon: Sunset }, { value: "night", label: "夜晚", Icon: Moon }] as const).map(({ value, label, Icon }) => <button key={value} aria-pressed={home.config.time === value} className={home.config.time === value ? "selected" : ""} onClick={() => changeConfig("time", value)}><Icon size={17} strokeWidth={1.5} />{label}</button>)}</div><label className="weather-toggle"><span>给庭院下一场小雨</span><input type="checkbox" checked={home.config.weather === "rain"} onChange={(event) => changeConfig("weather", event.target.checked ? "rain" : "clear")} /><span className="toggle-track" aria-hidden="true" /></label></fieldset>
        </> : <>
          <div className="car-model-label"><span className="car-line-art" aria-hidden="true">911</span><div><strong>一条熟悉的弧线。</strong><p>Carrera 4S · 为热爱选一种心情。</p></div></div>
          <fieldset className="option-group"><legend>车身颜色 <span>{colors.find((color) => color.value.toLowerCase() === home.config.carColor.toLowerCase())?.label || "专属色彩"}</span></legend><div className="color-options">{colors.map((color) => <button key={color.value} title={color.label} aria-label={color.label} aria-pressed={home.config.carColor === color.value} className={`color-swatch ${home.config.carColor === color.value ? "selected" : ""}`} style={{ "--swatch": color.value } as CSSProperties} onClick={() => changeConfig("carColor", color.value)}>{home.config.carColor === color.value && <Check size={15} />}</button>)}</div></fieldset>
          <fieldset className="option-group"><legend>轮圈饰面</legend><div className="segmented-options">{([{ value: "silver", label: "经典银色" }, { value: "black", label: "缎面黑色" }] as const).map((option) => <button key={option.value} aria-pressed={home.config.wheels === option.value} className={home.config.wheels === option.value ? "selected" : ""} onClick={() => changeConfig("wheels", option.value)}>{option.label}</button>)}</div></fieldset>
          <a className="model-disclosure" href="./models/attribution.txt" target="_blank" rel="noreferrer">车型模型：Lionsharp Studios · CC BY-SA 4.0 <ArrowUpRight size={10} /></a>
        </>}
        <div className="composer"><div className="composer-label"><Sparkles size={14} /><span>{aiReady ? "AI 空间设计师" : "一句话布置"}</span><span className={`model-state ${aiReady ? "connected" : ""}`}>{aiReady ? "已连接" : "基础模式"}</span></div><textarea aria-label="描述你理想中的空间" placeholder="例如：雨夜的松林，暖光车库，松林绿的车身……" value={prompt} maxLength={500} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) applyDesign(); }} /><div className="prompt-suggestions"><button onClick={() => setPrompt("日落、橄榄树、暖砂白车身")}>日落时分</button><button onClick={() => setPrompt("雨夜、松树、黑色轮圈")}>雨夜松林</button></div><button className="primary-button design-submit" onClick={applyDesign} disabled={designing || !prompt.trim()}>{designing ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}<span>{designing ? "正在布置…" : "让想象发生"}</span><ArrowRight size={15} /></button><p className="model-hint">{aiReady ? "AI 将调整可用的建筑、植物、天气和配色。" : "大模型待连接；当前按支持的风格关键词布置。"}</p></div>
        {designResult && <div className="design-result" role="status"><p>{designResult}</p>{undoConfig.current && <button onClick={() => { const config = undoConfig.current; if (config) setHome((current) => ({ ...current, config })); undoConfig.current = null; setDesignResult("已恢复上一次布置。"); }}><RotateCcw size={12} /> 撤销这次布置</button>}</div>}
      </div><button className="panel-story-button" onClick={openEdit}><PenLine size={13} /> 编辑家的名字与故事 <ArrowUpRight size={14} /></button>
    </aside>}
    {view === "workshop" && <section className="workshop-controls" aria-label="车辆细节与零件收藏">
      <div className="workshop-control-heading"><div><p className="eyebrow">EXPLORE THE DETAILS</p><select className="workshop-model-select" aria-label="车库车型" value={workshopModel.id} onChange={(event) => {
        const model = workshopModels.find(({ id }) => id === event.target.value);
        if (!model) return;
        setWorkshopModel(model);
      }}>{workshopModels.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></div><span className="pack-badge">{parts.length}/{PARTS.length}<small>已拥有</small></span></div>
      <span className="garage-meter" aria-hidden="true"><i style={{ width: `${Math.round((parts.length / PARTS.length) * 100)}%` }} /></span>
      <p className="garage-lede">抽到的零件会直接装到这台车上 —— <strong>已获得 = 实体亮钢</strong>，其余保持灰色幽灵。</p>
      <div className="garage-parts" role="list">{PARTS.map(item => { const owned = parts.includes(item.id); return <button key={item.id} role="listitem" title={`${RARITY_META[item.rarity].cn} · ${item.blurb}`} aria-label={`${item.name} ${RARITY_META[item.rarity].cn} ${owned ? "已获得" : "未获得"}`} className={`garage-part rarity-${item.rarity.toLowerCase()}${owned ? " is-owned" : ""}`} onClick={() => setModal("pack")}><span className="garage-part-art" style={{ "--art": `url(${item.image})` } as CSSProperties} aria-hidden="true" /><span className="garage-part-body"><strong>{item.name}</strong><small>{item.cn}</small></span><span className="garage-part-state">{owned ? "已获得" : "未获得"}</span></button>; })}</div>
      {!readOnly && <button className="pack-cta" disabled={exhibitStatus === "loading"} onClick={() => setModal("pack")}><Sparkles size={16} /><span>开一个零件盲盒</span><span className="pack-cta-count">{parts.length}/{PARTS.length}</span><ArrowUpRight size={15} /></button>}
      <p className="part-description">{installedPart ? <>当前装车：<strong>{partById(installedPart)?.name}</strong></> : "还没装车：抽到零件后在结果页点「装配」，这台车就会多一块实体零件。"}</p>
      <div className="prototype-workshop-footer"><p className="workshop-disclosure">{workshopModel.disclosure}</p>{workshopModel.instructions && <a className="text-button" href={workshopModel.instructions} target="_blank" rel="noreferrer">官方说明书 <ArrowUpRight size={13} /></a>}{!workshopModel.create && <button className="text-button" onClick={() => setModal("vehicle")}>车况档案 <ArrowUpRight size={13} /></button>}</div>
    </section>}
    <footer className="scene-footer"><span className="scene-number">{currentPlace.footer}</span><span className="scene-help">拖动旋转 <i /> 滚动缩放</span></footer>
    <nav className="bottom-nav valley-nav" aria-label="空间导航">{navigationPlaces.filter(place => (sample?.key !== "porsche-rd" && !isMunich) || place.id !== "workshop").map(({ id, label, Icon }) => id === "map" ? <Link key={id} href="/map"><Icon size={17} strokeWidth={1.6}/><span>{label}</span></Link> : <button key={id} className={view === id||(view==='entry'&&id==='home') ? "active" : ""} aria-current={view === id||(view==='entry'&&id==='home') ? "location" : undefined} onClick={() => selectPlace(id)}><Icon size={17} strokeWidth={1.6} /><span>{sample?.key === "porsche-rd" && id === "home" ? "庭院之家" : label}</span></button>)}</nav>
    {!readOnly && <button className={`customize-button ${panelOpen ? "is-open" : ""}`} onClick={() => { if (!panelOpen) selectPlace("home"); setPanelOpen(!panelOpen); }} aria-expanded={panelOpen} aria-label="布置空间"><Settings2 size={16} /><span>{panelOpen ? "收起布置" : "布置空间"}</span><ChevronDown size={13} /></button>}
    {readOnly && <a className="customize-button" href="./"><Home size={15} /><span>回到我的家</span><ArrowUpRight size={14} /></a>}
    </div>
    <SceneLoading visible={loading || !sceneReady} progress={loadingProgress} stage={loadingStage}/>
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice("")}><X size={14} /></button></div>}
    {modal === "phone" && <Dialog title="手机扫码体验" eyebrow="TAKE THE TOUR WITH YOU" onClose={closeModal}><PhoneEntry initialUrl={phoneUrl} /></Dialog>}
    {modal === "friends" && <Dialog title="好友车库" eyebrow="GARAGES AROUND THE WORLD" onClose={closeModal}><FriendsPanel friends={friends} current={currentFriend} onToggle={toggleFriend} /></Dialog>}
    {modal === "gallery" && <Dialog title="记忆与收藏" eyebrow="THE MEMORY GALLERY" onClose={closeModal}><GalleryPanel memories={memories} canEdit={!readOnly} onAdd={memory => {
      const next = [memory, ...memories];
      if (!writeLocal("memories", next)) { showNotice("浏览器未能保存这段记忆。"); return; }
      setMemories(next);
    }} /></Dialog>}
    {modal === "vehicle" && <Dialog title="车辆档案" eyebrow="THE GARAGE" onClose={closeModal}><VehiclePanel /></Dialog>}
    {modal === "stolen" && partById(stolenPart) && <Dialog title="偷卡成功！" eyebrow="来自慕尼黑之家" onClose={closeModal}>
      <div className="stolen-card-result">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={partById(stolenPart)!.image} alt={partById(stolenPart)!.cn} width={600} height={800} />
        <p>{partById(stolenPart)!.cn} · 已放入你的收藏</p>
        <p className="fine-print">好友互动演示，不会拿走对方的卡片。</p>
        <button className="primary-button" onClick={closeModal}>收下啦</button>
      </div>
    </Dialog>}
    {modal === "pack" && <Dialog title="零件盲盒" eyebrow="PARTS DROP / PLAYER PICK" onClose={closeModal} className="pack-modal"><PartsPackPanel collection={parts} installed={installedPart} onCollect={collectPart} onInstall={installPart} onClear={clearParts} /></Dialog>}
    {modal === "pet" && !readOnly && <Dialog title="庭院小伙伴" eyebrow="A FRIEND AT THE GATE" onClose={closeModal}><PetPanel pet={pet} onSave={value => {
      if (!writeLocal("pet", value)) { showNotice("浏览器未能保存宠物设置。"); return; }
      setPet(value);
      setModal(null);
      selectPlace("home");
    }} /></Dialog>}
    {modal === "story" && <Dialog title={view !== "workshop" ? home.title : "走近热爱的每一个细节"} eyebrow={view !== "workshop" ? "A STORY WORTH SHARING" : "INSIDE THE GARAGE"} onClose={closeModal} className="story-modal"><div className="story-rule" /><p className="story-owner">{view !== "workshop" ? `${home.ownerName} · 关于这座家` : "概念车库 · 车辆结构探索"}</p><p className="story-body">{view !== "workshop" ? home.story : "在车库里，你可以播放或拖动拼装进度，旋转查看车身、轮组、底盘与动力组件如何归位。Carrera 4S 的内部机械为结构示意，Technic 42096 则按模型装配分步演示。"}</p>{!readOnly && view !== "workshop" && <button className="text-button" onClick={openEdit}><PenLine size={14} /> 写下我的故事</button>}<p className="story-signoff">A home for your passion.</p></Dialog>}
    {modal === "edit" && <Dialog title="让这座家，更像你。" eyebrow="YOUR HOME, YOUR STORY" onClose={closeModal}><form className="edit-form" onSubmit={(event) => { event.preventDefault(); setHome((current) => ({ ...current, title: edit.title.trim(), ownerName: edit.ownerName.trim(), story: edit.story.trim() })); setModal(null); showNotice("故事已更新，记得保存你的家。"); }}><label>家的名字<input value={edit.title} maxLength={50} required onChange={(event) => setEdit({ ...edit, title: event.target.value })} /></label><label>怎么称呼你<input value={edit.ownerName} maxLength={30} required onChange={(event) => setEdit({ ...edit, ownerName: event.target.value })} /></label><label>我与爱车的故事<textarea value={edit.story} maxLength={800} required rows={5} onChange={(event) => setEdit({ ...edit, story: event.target.value })} /><span className="field-count">{edit.story.length}/800</span></label><button className="primary-button" type="submit">把故事放进家里 <ArrowRight size={15} /></button></form></Dialog>}
    {modal === "invite" && <Dialog title="好风景，想与你分享。" eyebrow="YOU ARE ALWAYS WELCOME" onClose={closeModal}><div className="invitation-illustration" aria-hidden="true"><Home size={34} strokeWidth={1} /><span>COME ON OVER</span><div className="invitation-stamp">HOME<br />911</div></div><p className="modal-copy">邀请朋友走进「{home.title}」，看看你的车，读一段故事，留下一张明信片。</p><label className="invite-link-label">专属拜访链接<div className="invite-link-row"><input aria-label="专属拜访链接" readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /><button aria-label="复制拜访链接" onClick={copyInvite}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div></label><div className="invite-dialog-actions"><button className="primary-button" onClick={copyInvite}>{copied ? "链接已复制" : "复制邀请链接"}{copied ? <Check size={15} /> : <ArrowRight size={15} />}</button><a className="text-button" href={inviteUrl} target="_blank" rel="noreferrer">以访客身份打开 <ArrowUpRight size={14} /></a></div><p className="fine-print">拜访链接受站点访问权限限制，仅已获权限的朋友可打开。</p></Dialog>}
    {modal === "postcards" && <Dialog title={readOnly ? "把这一刻，留在这里。" : "远方来信，近在眼前。"} eyebrow="POSTCARDS FROM FRIENDS" onClose={closeModal} className="postcards-modal"><div className="postcards-layout"><section className="postcard-compose"><div className={`postcard-preview theme-${postcard.theme}`}><span className="postcard-kicker">A LITTLE NOTE, A LASTING MEMORY</span><div className="postcard-stamp">P<span>HOME</span></div><label className="sr-only" htmlFor="postcard-message">明信片内容</label><textarea id="postcard-message" placeholder="来过这里，想对你说……" value={postcard.message} maxLength={300} onChange={(event) => setPostcard({ ...postcard, message: event.target.value })} /><div className="postcard-from"><span>FROM</span><label className="sr-only" htmlFor="postcard-name">你的名字</label><input id="postcard-name" placeholder="你的名字" maxLength={30} value={postcard.name} onChange={(event) => setPostcard({ ...postcard, name: event.target.value })} /></div><span className="postcard-address">TO · {home.ownerName}的家</span></div><fieldset className="postcard-themes"><legend>选一张喜欢的信纸</legend>{[{ value: "forest", label: "森林绿" }, { value: "sand", label: "暖砂色" }, { value: "sunset", label: "夕阳粉" }].map((theme) => <button key={theme.value} aria-label={theme.label} title={theme.label} aria-pressed={postcard.theme === theme.value} className={`theme-dot theme-${theme.value} ${postcard.theme === theme.value ? "selected" : ""}`} onClick={() => setPostcard({ ...postcard, theme: theme.value })}>{postcard.theme === theme.value && <Check size={12} />}</button>)}</fieldset>{postError && <p className="form-error" role="alert">{postError}</p>}<button className="primary-button" onClick={sendPostcard} disabled={posting || !postcard.name.trim() || !postcard.message.trim()}>{posting ? <LoaderCircle size={15} className="spin" /> : <Mail size={15} />} {posting ? "正在投递…" : "寄出这张明信片"} <ArrowUpRight size={15} /></button>{sample ? <p className="fine-print">演示明信片保存在当前浏览器。</p> : !home.id && <p className="fine-print">空间保存后，即可收发明信片。</p>}</section><section className="postcard-inbox" aria-label="收到的明信片"><div className="inbox-title"><span>留在这里的心意</span><span>{home.postcards.length.toString().padStart(2, "0")}</span></div>{home.postcards.length === 0 ? <div className="empty-postcards"><Mail size={30} strokeWidth={1} /><p>第一封来信，还在路上。</p><span>邀请一个朋友，<br />让这里开始有共同的回忆。</span></div> : home.postcards.map((card) => <article key={card.id} className={`received-postcard theme-${["forest", "sand", "sunset"].includes(card.theme) ? card.theme : "forest"}`}><p>{card.message}</p><div><span>— {card.name}</span><time dateTime={new Date(card.createdAt).toISOString()}>{new Date(card.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" })}</time></div></article>)}</section></div></Dialog>}
  </main>;
}






