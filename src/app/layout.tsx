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
            <span className="brand-sub">The party's pie business · runs on the DM's machine</span>
          </div>
          <Nav />
          <span className="notice" title="Simulated results are provisional. Only reports the DM publishes become part of the campaign.">
            Provisional until the DM publishes
          </span>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
