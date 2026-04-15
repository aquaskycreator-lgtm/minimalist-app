import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ミニマリスト＆片付けアプリ",
  description: "冷蔵庫・クローゼット・日用品の在庫管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-[#faf9f7] text-[#3d3530]">
        {children}
      </body>
    </html>
  );
}
