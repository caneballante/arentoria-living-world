import { publicCatalog } from "@/server/catalog";
import { CampaignApp } from "@/ui/CampaignApp";

export const dynamic = "force-dynamic";

export default function CampaignPage() {
  return <CampaignApp catalog={publicCatalog()} />;
}
