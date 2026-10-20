import { QuranSurahName } from "@/components/shared/quran/name";

/** One surah in the Quran index: its number in a ring, then its two names. */
export function QuranSurahRow({
  arabic,
  number,
  title,
}: {
  arabic: string;
  number: number;
  title: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
        <span className="font-mono text-xs tracking-tighter">{number}</span>
      </div>
      <h2 className="flex min-w-0 items-baseline gap-2">
        <QuranSurahName arabic={arabic} title={title} />
      </h2>
    </div>
  );
}
