import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "保时捷之家 · Porsche Home",
  description: "一台喜欢的车，一个自己的世界。布置专属庭院，探索 911 车库，邀请朋友来访并留下明信片。",
  icons: { icon: "./favicon.svg", shortcut: "./favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
