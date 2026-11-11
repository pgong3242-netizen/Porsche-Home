import type { Metadata } from 'next';
import DioramaLab from '@/components/hardsurface/DioramaLab';

export const metadata: Metadata = {
  title: 'SELENE // SITE 07 · 工业硬表面样片',
  description: '程序化生成的工业硬表面 3D 场景样片：月面基地平台、主穹顶与作业照明阵列。',
};

export default function HardSurfacePage() {
  return <main className="hs-page">
    <DioramaLab />
  </main>;
}
