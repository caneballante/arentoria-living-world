import { publicCatalog } from "@/server/catalog";
import { SandboxApp } from "@/ui/SandboxApp";

export default function Home() {
  return <SandboxApp catalog={publicCatalog()} />;
}
