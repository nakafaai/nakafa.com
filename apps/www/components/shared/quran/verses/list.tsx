import type { QuranViewVerse } from "@repo/backend/client/quran/view";
import type { ReactNode } from "react";
import { QuranVerseItem } from "@/components/shared/quran/verses/item";
import { WindowVirtualized } from "@/components/shared/window-virtualized";

interface VerseItem {
  id: string;
  label: string;
  verse: QuranViewVerse;
}

interface Props {
  items: readonly VerseItem[];
  renderAction?: (verse: QuranViewVerse) => ReactNode;
  translationNotesLabel: string;
}

const QURAN_INITIAL_VERSE_SSR_COUNT = 80;

/** Renders the virtualized, SEO-visible verses for one Quran surah. */
export function QuranVerseList({
  items,
  renderAction,
  translationNotesLabel,
}: Props) {
  return (
    <WindowVirtualized
      ssrCount={Math.min(items.length, QURAN_INITIAL_VERSE_SSR_COUNT)}
    >
      {items.map(({ id, label, verse }, index) => (
        <QuranVerseItem
          action={renderAction?.(verse)}
          id={id}
          isLast={index === items.length - 1}
          key={verse.number.inQuran}
          translationNotesLabel={translationNotesLabel}
          verse={verse}
          verseLabel={label}
        />
      ))}
    </WindowVirtualized>
  );
}
