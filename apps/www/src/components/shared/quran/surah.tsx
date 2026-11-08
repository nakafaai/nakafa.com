import type { ReactNode } from "react";

/** A surah's number in its ring, as the index and a surah search show it. */
export function QuranSurahNumber({ number }: { number: number }) {
  return (
    <span className="border-primary bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-full border">
      <span className="font-mono text-xs tracking-tighter">{number}</span>
    </span>
  );
}

/**
 * One surah in the Quran index: its number in a ring, then its two names, which
 * the index composes, and the meaning of its name under them.
 */
export function QuranSurahRow({
  children,
  meaning,
  ring,
}: {
  children: ReactNode;
  meaning: string;
  /** The surah's number in its ring (`QuranSurahNumber`). */
  ring: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {ring}
      <div className="flex min-w-0 flex-col">
        <h2 className="flex min-w-0 items-center gap-2">{children}</h2>
        <p className="text-muted-foreground truncate text-sm">{meaning}</p>
      </div>
    </div>
  );
}
