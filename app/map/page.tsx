import type { Metadata } from 'next';
import Link from 'next/link';
import { Home, Map, Wrench } from 'lucide-react';
import FriendsMap from '@/components/FriendsMap';

export const metadata: Metadata = { title: '好友地图 · Porsche Home' };

export default function MapPage() {
  return <main className="home-app is-map">
    <FriendsMap />
    <nav className="bottom-nav valley-nav" aria-label="空间导航">
      <Link href="/map" className="active" aria-current="page"><Map size={17} strokeWidth={1.6}/><span>地图</span></Link>
      <Link href="/?view=home"><Home size={17} strokeWidth={1.6}/><span>归处</span></Link>
      <Link href="/?view=workshop"><Wrench size={17} strokeWidth={1.6}/><span>车库</span></Link>
    </nav>
  </main>;
}
