import { readLocal, writeLocal } from './demo-world';

export type Rarity = 'Rare' | 'Epic' | 'Legendary';

export type Part = {
  id: string;
  /** Top-left label printed on the card art. */
  category: string;
  /** Card title, as printed on the art. */
  name: string;
  /** Sub-line printed under the title on the art. */
  subtitle: string;
  /** Chinese name used in the garage. */
  cn: string;
  /** Card number, as printed on the art. */
  code: string;
  rarity: Rarity;
  /** Which system the part bolts onto — the garage slot it lands in. */
  fit: string;
  image: string;
  blurb: string;
};

export const PARTS: Part[] = [
  {
    id: 'engine', category: 'ENGINE', name: '4.0L FLAT-SIX', subtitle: 'GT3 4.0 Boxer',
    cn: '自然吸气水平对置六缸', code: 'NO. 040-6', rarity: 'Legendary', fit: '动力总成',
    image: './parts/engine.webp',
    blurb: '510 PS / 9,000 rpm 红线，3,996 cc 自然吸气水平对置六缸。整个零件包里最难得的一张。',
  },
  {
    id: 'transmission', category: 'TRANSMISSION', name: 'PDK', subtitle: '7-Speed Dual Clutch',
    cn: '7 速双离合变速箱', code: 'NO. 740-7D', rarity: 'Epic', fit: '传动',
    image: './parts/transmission.webp',
    blurb: '7 速湿式双离合，耐受 760 N·m，约 100 ms 完成换挡，动力几乎不中断。',
  },
  {
    id: 'wheels', category: 'WHEELS & TYRES', name: 'Center Lock', subtitle: 'Magnesium Wheel',
    cn: '锻造镁合金中央锁止轮组', code: 'NO. 040-7', rarity: 'Rare', fit: '行走机构',
    image: './parts/wheels.webp',
    blurb: '20 / 21 英寸锻造镁合金轮圈，中央锁止单螺母，簧下质量轻 25%。',
  },
  {
    id: 'brakes', category: 'BRAKES', name: 'PCCB', subtitle: 'Porsche Ceramic Composite Brake',
    cn: '陶瓷复合制动系统', code: 'NO. 020-6', rarity: 'Epic', fit: '制动',
    image: './parts/brakes.webp',
    blurb: '碳陶瓷制动盘，前 410 mm / 后 390 mm，六活塞卡钳，制动距离更短且几乎无热衰减。',
  },
  {
    id: 'suspension', category: 'SUSPENSION', name: 'PASM', subtitle: 'Porsche Active Suspension Management',
    cn: '主动悬挂管理系统', code: 'NO. 030-6', rarity: 'Rare', fit: '底盘',
    image: './parts/suspension.webp',
    blurb: '连续阻尼控制，Normal / Sport / Track 三种设定，车身再降 30 mm，响应 < 10 ms。',
  },
];

/** The single card back shipped with the pack. */
export const CARD_BACK = './parts/back.webp';

/**
 * 彩蛋：抽到 engine 卡片后，结果区会多一个「发动机 3D 拆分」按钮。
 * 指向站内静态页 /engine-brokendown/（源在 public/engine-brokendown/，由零构建项目
 * exploded-view-studio 同步而来；同源、同 5173 端口，不再需要单独的 :5199 静态服务）。
 * 相对路径，换域名 / 局域网访问都不用改。
 */
export const ENGINE_EXPLODED_VIEW = './engine-brokendown/';

export const RARITY_META: Record<Rarity, { label: string; cn: string; order: number }> = {
  Rare: { label: 'RARE', cn: '稀有', order: 0 },
  Epic: { label: 'EPIC', cn: '史诗', order: 1 },
  Legendary: { label: 'LEGENDARY', cn: '传奇', order: 2 },
};

export function partById(id: string | null | undefined): Part | null {
  return PARTS.find(part => part.id === id) ?? null;
}

function shuffle<T>(input: T[]): T[] {
  const list = [...input];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Deal one pack. Cards the player has not collected yet are dealt first, so a
 * demo run actually fills the garage; once everything is owned the pool is just
 * the full set again (重复体验 / 无限抽).
 */
export function dealPack(collected: string[], count = 3): Part[] {
  const owned = new Set(collected);
  const fresh = shuffle(PARTS.filter(part => !owned.has(part.id)));
  const repeats = shuffle(PARTS.filter(part => owned.has(part.id)));
  return shuffle([...fresh, ...repeats].slice(0, Math.min(count, PARTS.length)));
}

const COLLECTION_KEY = 'parts';
const INSTALLED_KEY = 'parts-installed';

export function readCollection(): string[] {
  const value = readLocal<string[]>(COLLECTION_KEY, []);
  return Array.isArray(value) ? value.filter(id => PARTS.some(part => part.id === id)) : [];
}

export function writeCollection(ids: string[]): boolean {
  return writeLocal(COLLECTION_KEY, ids);
}

export function readInstalled(): string | null {
  const value = readLocal<string | null>(INSTALLED_KEY, null);
  return partById(value) ? value : null;
}

export function writeInstalled(id: string | null): boolean {
  return writeLocal(INSTALLED_KEY, id);
}

/** 演示用：一次性清空收藏 + 装配记录（localStorage 两把 key），回到 0/5 重新开包。 */
export function clearCollection(): boolean {
  return writeCollection([]) && writeInstalled(null);
}
