"use client";

import type { ReactNode } from "react";

export function TryoutPartHero({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export function TryoutPartSummary({ children }: { children: ReactNode }) {
  return (
    <section className="max-w-2xl rounded-xl border bg-card px-5 py-4 shadow-sm">
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function TryoutPartBadges({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function TryoutPartBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {children}
    </div>
  );
}

export function TryoutPartCtas({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}
