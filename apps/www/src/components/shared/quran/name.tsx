/** A surah's transliterated name with its Arabic name beside it. */
export function QuranSurahName({
  arabic,
  title,
}: {
  arabic: string;
  title: string;
}) {
  return (
    <>
      <span className="min-w-0 truncate">{title}</span>
      <span className="shrink-0 font-normal text-xl" dir="rtl" lang="ar">
        {arabic}
      </span>
    </>
  );
}
