"use client";

import type { ReactNode } from "react";

export function TryoutPartSummary({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function TryoutPartBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

export function TryoutPartLead({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-5">{children}</div>;
}

export function TryoutPartStats({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full max-w-xl gap-x-8 gap-y-3 sm:grid-cols-2 sm:gap-x-10">
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
    <div className="flex flex-col text-left">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}

export function TryoutPartCtas({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}
