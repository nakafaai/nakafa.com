/** A surah's transliterated name with its Arabic name beside it, in the Quran's face. */
export function QuranSurahName({
  arabic,
  title,
}: {
  arabic: string;
  title: string;
}) {
  return (
    <>
      <span className="min-w-0 text-pretty">{title}</span>
      <span
        className="font-quran shrink-0 text-xl font-normal"
        dir="rtl"
        lang="ar"
      >
        {arabic}
      </span>
    </>
  );
}
