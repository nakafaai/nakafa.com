import type { QuranViewVerse } from "@repo/backend/client/quran/view";
import { QuranVerse } from "@/components/shared/quran/verse";
import { WindowVirtualized } from "@/components/shared/window-virtualized";

interface QuranVerseItem {
  id: string;
  label: string;
  verse: QuranViewVerse;
}

interface Props {
  hasInterpretation: boolean;
  interpretationLabel: string;
  items: readonly QuranVerseItem[];
}

const QURAN_INITIAL_VERSE_SSR_COUNT = 80;

/** Renders the virtualized, SEO-visible verses for one Quran surah. */
export function QuranVerseList({
  hasInterpretation,
  interpretationLabel,
  items,
}: Props) {
  return (
    <WindowVirtualized
      ssrCount={Math.min(items.length, QURAN_INITIAL_VERSE_SSR_COUNT)}
    >
      {items.map(({ id, label, verse }, index) => (
        <QuranVerse
          hasInterpretation={hasInterpretation}
          id={id}
          interpretationLabel={interpretationLabel}
          isLast={index === items.length - 1}
          key={verse.number.inQuran}
          verse={verse}
          verseLabel={label}
        />
      ))}
    </WindowVirtualized>
  );
}
