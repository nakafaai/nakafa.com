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
        className="shrink-0 font-normal font-quran text-xl"
        dir="rtl"
        lang="ar"
      >
        {arabic}
      </span>
    </>
  );
}
