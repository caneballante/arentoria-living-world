import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/ui/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arentoria Living World",
  description: "Simulation-driven companion to a D&D campaign in Arentoria — Phase 1 sandbox.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">Arentoria Living World</span>
            <span className="brand-sub">Phase 1 · pie-business sandbox</span>
          </div>
          <Nav />
          <span className="notice" title="Nothing in this sandbox changes campaign canon.">
            Sandbox · provisional · not canon
          </span>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
