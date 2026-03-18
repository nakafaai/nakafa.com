"use client";

import type { ReactNode } from "react";

export function TryoutPartHero({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export function TryoutPartSummary({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card px-5 py-5 shadow-sm sm:px-6 sm:py-6">
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function TryoutPartBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
      {children}
    </div>
  );
}

export function TryoutPartLead({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-5">{children}</div>;
}

export function TryoutPartStats({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full max-w-xl grid-cols-2 gap-x-8 gap-y-3 sm:gap-x-10">
      {children}
    </div>
  );
}

export function TryoutPartStat({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0 text-left">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}

export function TryoutPartCtas({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap justify-start gap-3 sm:w-auto sm:justify-end sm:self-end">
      {children}
    </div>
  );
}
