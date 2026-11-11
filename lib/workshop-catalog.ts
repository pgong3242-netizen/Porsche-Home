import type { Group, Vector3 } from 'three';
import type { CarPart } from './car-geometry';
import { rsrChapters, rsrChapterTimes } from './rsr-chapters';

type PartInfo = Record<string, { name: string; copy: string }>;
export type WorkshopExhibit = {
  group: Group;
  parts: CarPart[];
  syncOwned?: (owned: readonly string[], delta: number) => void;
  assemble?: (progress: number) => void;
  focus?: (progress: number) => { target: Vector3; cameraOffset: Vector3 } | null;
};

type WorkshopModel = {
  id: string;
  name: string;
  disclosure: string;
  duration: number;
  parts: PartInfo;
  create?: (signal?: AbortSignal) => WorkshopExhibit | Promise<WorkshopExhibit>;
  prefetch?: () => Promise<unknown>;
  chapters?: readonly { key: string; label: string; progress: number; jump: number }[];
  instructions?: string;
};

export const workshopModels: readonly WorkshopModel[] = [
  {
    id: 'gt3-rs',
    name: '911 GT3 RS',
    disclosure: 'GT3 RS · 模型：blenderbett / CC BY 4.0',
    duration: 0,
    parts: {},
    create: signal => import('./gt3-rs').then(module => module.loadGt3Rs(signal)),
    prefetch: () => import('./gt3-rs').then(module => module.prefetchGt3Rs()),
  },
  {
    id: 'technic-42096',
    name: 'Technic 42096 · 911 RSR',
    disclosure: '分步拼装 · LDraw 模型：Philippe Hurbain',
    duration: 51000,
    create: signal => import('./rsr-assembly').then(module => module.loadRsrAssembly(signal)),
    instructions: 'https://www.lego.com/en-us/service/building-instructions/42096',
    chapters: rsrChapters.map(({ key, label }, index) => ({ key, label, progress: rsrChapterTimes[index], jump: rsrChapterTimes[index] + rsrChapters[index].weight * (key === 'powertrain' ? .60 : .75) })),
    parts: {
      chassis: { name: '后桥与差速器', copy: '从差速器、半轴、连杆与避震开始搭建。' },
      front: { name: '前桥与悬架', copy: '前桥模块接入底盘，连杆与转向机构逐步就位。' },
      powertrain: { name: '六缸发动机', copy: '近看黄色活塞、曲轴与两侧气缸装入底盘。' },
      cabin: { name: '座舱与骨架', copy: '座椅与支架装入孔梁骨架。' },
      body: { name: '车身与灯组', copy: '车门、轮拱、前盖与灯组逐段装到车架上。' },
      finish: { name: '尾翼与轮组', copy: '尾翼、车顶和轮组装好，完成 911 RSR。' },
    },
  },
];
