"use client";

import { useEffect, useMemo, useState } from "react";

const SYSTEM_STATUS_TEXT = "All systems operational";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

type FooterNavLink = {
  label: string;
  href: string;
};

interface SiteFooterProps {
  navLinks?: FooterNavLink[];
}

export function SiteFooter({ navLinks }: SiteFooterProps) {
  const [formattedTime, setFormattedTime] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<string | null>(null);

  const links = useMemo<FooterNavLink[]>(
    () =>
      navLinks && navLinks.length > 0
        ? navLinks
        : [
            { label: "Home", href: "#top" },
            { label: "Projects", href: "#projects" },
            { label: "About", href: "#about" },
          ],
    [navLinks]
  );

  useEffect(() => {
    const updateTime = () => {
      setFormattedTime(formatTime(new Date()));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleResize() {
      setDimensions(`${window.innerWidth}×${window.innerHeight}`);
    }

    if (typeof window === "undefined") {
      return;
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <footer className="relative mt-20 w-full">
      <div
        className="border-t border-[rgba(38,37,30,0.1)] bg-[#f5f4ef] text-[#26251e]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(38,37,30,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(38,37,30,0.04) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="mx-auto max-w-[1000px] px-6 py-12">
          <div className="rounded-[24px] border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,252,0.8)] px-8 py-10 shadow-[0_24px_60px_rgba(38,37,30,0.12)] backdrop-blur-sm">
            <div className="grid gap-10 md:grid-cols-3">
              <div className="space-y-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.55)]">
                  System
                </h3>
                <div className="space-y-4 text-xs text-[rgba(38,37,30,0.7)]">
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[rgba(38,37,30,0.45)]">Time</span>
                    <span>{formattedTime ?? "--:--:--"}</span>
                  </div>
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[rgba(38,37,30,0.45)]">View</span>
                    <span>{dimensions ?? "----×----"}</span>
                  </div>
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-[rgba(38,37,30,0.45)]">Env</span>
                    <span>Production</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.55)]">
                  Navigate
                </h3>
                <nav className="flex flex-col gap-3 text-xs text-[rgba(38,37,30,0.65)]">
                  {links.map((link) => {
                    const isExternal = /^https?:\/\//.test(link.href);

                    return (
                      <a
                        key={link.href + link.label}
                        className="relative inline-flex items-center gap-2 transition-colors duration-200 hover:text-[#f54e00]"
                        href={link.href}
                        rel={isExternal ? "noreferrer" : undefined}
                        target={isExternal ? "_blank" : undefined}
                      >
                        <span aria-hidden>→</span>
                        <span>{link.label}</span>
                      </a>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[rgba(38,37,30,0.55)]">
                  Connect
                </h3>
                <div className="flex gap-5 text-[rgba(38,37,30,0.65)]">
                  <a
                    href="https://github.com/R0bk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition duration-200 hover:scale-110 hover:text-[#f54e00]"
                    aria-label="GitHub"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </a>
                  <a
                    href="https://www.linkedin.com/in/robert-kopel/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition duration-200 hover:scale-110 hover:text-[#f54e00]"
                    aria-label="LinkedIn"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    </svg>
                  </a>
                  <a
                    href="https://x.com/_robkop_"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition duration-200 hover:scale-110 hover:text-[#f54e00]"
                    aria-label="Twitter"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(38,37,30,0.08)] bg-[#eceae4] relative z-50">
        <div className="mx-auto flex max-w-[1000px] flex-col items-start justify-between gap-4 px-6 py-5 text-xs text-[rgba(38,37,30,0.65)] md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(38,37,30,0.08)] text-[rgba(38,37,30,0.7)]">
              RK
            </span>
            <p className="font-mono">© 2025 Rob Kopel • BNE, AU</p>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#2ecc71]" aria-hidden />
            <span>{SYSTEM_STATUS_TEXT}</span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 right-0 h-24"
        style={{
          background:
            "linear-gradient(to bottom, rgba(247,247,244,0) 0%, rgba(247,247,244,0.45) 55%, rgba(237,235,229,0.94) 100%)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />
    </footer>
  );
}
