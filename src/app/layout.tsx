import type { Metadata } from "next";
import "./globals.css";
import { NavHeader } from "@/components/NavHeader";

export const metadata: Metadata = {
  title: "Blast Radius Simulator",
  description: "Model service dependencies and simulate cascading failures.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full h-full flex flex-col bg-zinc-950 text-zinc-200">
        <NavHeader />
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
