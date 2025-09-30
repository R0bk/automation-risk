import { Hero } from "@/components/run/hero";
import { MostViewedMarketplace } from "@/components/run/most-viewed-marketplace";
import { TrendingRuns } from "@/components/run/trending-runs";
import { SiteFooter } from "@/components/site-footer";
import type { MarketplacePage } from "@/lib/run/marketplace-types";

const LANDING_FOOTER_LINKS = [
  { label: "Home", href: "#top" },
  { label: "Trending", href: "#trending" },
  { label: "Marketplace", href: "#marketplace" },
];

function resolveBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return baseUrl;
}

async function fetchSummary() {
  const baseUrl = resolveBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/run?summary=1`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data as {
      status: string;
      remainingRuns?: number;
      trending?: Array<{
        runId: string;
        slug: string | null;
        displayName: string | null;
        status: string | null;
        viewCount: number;
        updatedAt: string | null;
      }>;
    };
  } catch (error) {
    console.warn("Failed to load summary", error);
    return null;
  }
}

async function fetchMarketplacePage(limit = 12): Promise<MarketplacePage | null> {
  const baseUrl = resolveBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/run/marketplace?limit=${limit}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as MarketplacePage;
    return data;
  } catch (error) {
    console.warn("Failed to load marketplace page", error);
    return null;
  }
}

export default async function Page() {
  const summary = await fetchSummary();
  const remainingRuns = summary?.remainingRuns ?? null;
  const trending = summary?.trending ?? [];
  const marketplaceInitial = await fetchMarketplacePage();

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      id="top"
      style={{ backgroundColor: "#f7f7f4" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,78,0,0.08),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,_rgba(31,138,101,0.08),_transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27 fill=%27none%27 viewBox=%270 0 120 120%27%3E%3Cpath stroke=%27%2326251e%27 stroke-opacity=%270.2%27 stroke-width=%270.6%27 d=%27M60 0v120M0 60h120%27/%3E%3C/svg%3E')",
          }}
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-6 pb-32 pt-28 text-[#26251e]">
        <Hero remainingRuns={remainingRuns} />
{/* 
        <section className="grid gap-5 sm:grid-cols-3">
          {[
            {
              title: "Iterative web intelligence",
              body:
                "GPT-5 orchestrates up to 100 native web searches to reconstruct org structure with citations in real time.",
            },
            {
              title: "O*NET-aligned workforce lens",
              body:
                "Titles collapse into canonical role families so automation and augmentation scores stay comparable across firms.",
            },
            {
              title: "Permanent public replays",
              body:
                "Every completed run stays public—no re-billing, just instant streaming of the original analysis trace.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group rounded-[20px] border border-[rgba(38,37,30,0.1)] px-6 py-7 shadow-[0_24px_48px_rgba(34,28,20,0.12)] transition hover:border-[rgba(38,37,30,0.18)] hover:shadow-[0_30px_60px_rgba(34,28,20,0.16)]"
              style={{
                backgroundImage: "linear-gradient(155deg, rgba(242,241,237,0.96), rgba(233,231,225,0.9))",
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.6)]">
                {item.title}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[rgba(38,37,30,0.68)]">{item.body}</p>
            </div>
          ))}
        </section> */}

        <div id="trending">
          <TrendingRuns runs={trending} />
        </div>

        <div id="marketplace">
          <MostViewedMarketplace initialPage={marketplaceInitial} pageSize={12} />
        </div>
      </main>

      <SiteFooter navLinks={LANDING_FOOTER_LINKS} />
    </div>
  );
}
