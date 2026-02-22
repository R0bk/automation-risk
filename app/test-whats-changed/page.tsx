import { WhatsChanged } from "@/components/run/whats-changed";
import { ComparativeInsights } from "@/components/run/comparative-insights";
import { loadOnetCatalog, getTopMovers } from "@/lib/onet/catalog";
import { loadComparativeInsights } from "@/lib/run/load-comparative-insights";

function WhatsChangedSync() {
  const catalog = loadOnetCatalog();
  const movers = getTopMovers(catalog, 6);
  return <WhatsChanged movers={movers} />;
}

async function ComparativeInsightsAsync() {
  const { data, updatedAt } = await loadComparativeInsights();
  return <ComparativeInsights analytics={data} updatedAt={updatedAt} />;
}

export default function TestPage() {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "#f7f7f4" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,78,0,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,_rgba(31,138,101,0.08),_transparent_45%)]" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-6 pb-32 pt-16 text-[#26251e]">
        <WhatsChangedSync />
        <ComparativeInsightsAsync />
      </main>
    </div>
  );
}
