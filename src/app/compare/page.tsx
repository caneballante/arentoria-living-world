import type { Metadata } from "next";
import { publicCatalog } from "@/server/catalog";
import { CompareApp } from "@/ui/CompareApp";

export const metadata: Metadata = { title: "Compare strategies · Arentoria Living World" };

export default function ComparePage() {
  return <CompareApp catalog={publicCatalog()} />;
}
