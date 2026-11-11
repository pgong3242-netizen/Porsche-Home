export const rsrChapters = [
  { key: 'chassis', label: '后桥与差速器', from: 0, to: 10, weight: .14 },
  { key: 'front', label: '前桥与悬架', from: 10, to: 31, weight: .23 },
  { key: 'powertrain', label: '六缸发动机', from: 31, to: 32, weight: .23 },
  { key: 'cabin', label: '座舱与骨架', from: 32, to: 61, weight: .16 },
  { key: 'body', label: '车身与灯组', from: 61, to: 103, weight: .15 },
  { key: 'finish', label: '尾翼与轮组', from: 103, to: Infinity, weight: .09 },
];

export const rsrChapterTimes = rsrChapters.map((_, i) =>
  rsrChapters.slice(0, i).reduce((sum, chapter) => sum + chapter.weight, 0),
);

