import type { ReactNode } from "react";

/**
 * One surah in the Quran index: its number in a ring, then its two names, which
 * the index composes, and the meaning of its name under them.
 */
export function QuranSurahRow({
  children,
  meaning,
  number,
}: {
  children: ReactNode;
  meaning: string;
  number: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="border-primary bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-full border">
        <span className="font-mono text-xs tracking-tighter">{number}</span>
      </div>
      <div className="flex min-w-0 flex-col">
        <h2 className="flex min-w-0 items-center gap-2">{children}</h2>
        <p className="text-muted-foreground truncate text-sm">{meaning}</p>
      </div>
    </div>
  );
}
