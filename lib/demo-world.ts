import { DEMO_HOME, type HomeData, type HomeConfig } from './home-config';

export type PetKind = 'none' | 'cat' | 'dog';
export type Pet = { kind: PetKind; name: string };
export type Friend = { key: string; name: string; title: string; region: string; href: string };
export type Memory = { id: string; category: string; date: string; title: string; note: string };

const sampleHomes = [
  { key: 'porsche-china', name: '保时捷中国', title: '陆家嘴 · 中国总部', region: '上海 · 陆家嘴金融广场', story: '以陆家嘴金融广场办公塔楼为背景的中国总部场景。建筑体量经过缩比和风格化处理，方便线上拜访。', plants: 'olive', carColor: '#e9e7dc', pet: { kind: 'none', name: '' } },
  { key: 'porsche-rd', name: '保时捷中国研发中心', title: '江桥 · 研发中心', region: '上海 · 嘉定江桥', story: '参考江桥研发中心实景，重建银灰色研发楼、玻璃转角与后方办公高楼。布局与尺寸为照片参考下的风格化还原。', plants: 'pine', carColor: '#466b82', pet: { kind: 'none', name: '' } },
  { key: 'munich', name: 'Alpine Sunday', title: '慕尼黑 · 穹顶之家', region: '德国 · 慕尼黑', story: '从慕尼黑出发，沿着阿尔卑斯山脚的公路慢慢走。回到自己的穹顶之家，停好黑色的爱车，和远道而来的朋友聊聊今天的旅程。', plants: 'pine', carColor: '#101216', pet: { kind: 'none', name: '' } },
  { key: 'shanghai', name: '林', title: '梧桐下的车库', region: '中国 · 上海', story: '周末从城里出发，沿着江岸一路向南。回家之后，总想再去车库看一眼。', plants: 'olive', carColor: '#9d2927', pet: { kind: 'cat', name: '栗子' } },
  { key: 'stuttgart', name: 'Alex', title: '松林里的周末', region: '德国 · 斯图加特', story: '第一次上赛道的号码牌一直留在展亭里。每次看见它，都记得出维修区的那一刻。', plants: 'pine', carColor: '#556b58', pet: { kind: 'dog', name: 'Otto' } },
  { key: 'tokyo', name: 'Haru', title: '山路尽头的灯', region: '德国 · 慕尼黑', story: '清晨上山，看雾一点点散开。入夜后，庭院里的灯是最后一道弯的路标。', plants: 'cypress', carColor: '#466b82', pet: { kind: 'cat', name: 'Sora' } },
] satisfies Array<Omit<Friend, 'href'> & { story: string; plants: HomeConfig['plants']; carColor: string; pet: Pet }>;

export const sampleFriends: Friend[] = sampleHomes.map(({ key, name, title, region }) => ({
  key, name, title, region, href: `./?demo=${key}`,
}));

export const sampleMemories: Memory[] = [
  { id: 'track', category: '赛道', date: '2026-10-18', title: '第一次完整跑完赛道日', note: '午后的最后一节，终于找到了入弯和出弯的节奏。' },
  { id: 'club', category: '车主活动', date: '2026-09-27', title: '清晨六点的车友集合', note: '六台车从城里出发，在山脚下交换了一张合影。' },
  { id: 'service', category: '保养', date: '2026-08-12', title: '完成年度保养', note: '检查制动、轮胎和油液，为下一趟长途做好准备。' },
];

export function getSampleHome(key: string | null): { home: HomeData; friend: Friend; pet: Pet } | null {
  const sample = sampleHomes.find(home => home.key === key);
  const friend = sampleFriends.find(item => item.key === key);
  if (!sample || !friend) return null;
  return {
    friend,
    pet: sample.pet,
    home: {
      ...DEMO_HOME, title: sample.title, ownerName: sample.name, story: sample.story,
      isOwner: false, postcards: [], config: { ...DEMO_HOME.config, plants: sample.plants, carColor: sample.carColor },
    },
  };
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`porsche-home:${key}:v1`);
    return value === null ? fallback : JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(`porsche-home:${key}:v1`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function localRecordId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('');
}
