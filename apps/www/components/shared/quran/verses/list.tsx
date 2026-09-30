import type { QuranViewVerse } from "@repo/backend/client/quran/view";
import type { ReactNode } from "react";
import { QuranVerseItem } from "@/components/shared/quran/verses/item";
import { WindowVirtualized } from "@/components/shared/quran/verses/virtual";

interface VerseItem {
  id: string;
  label: string;
  verse: QuranViewVerse;
}

interface Props {
  items: readonly VerseItem[];
  renderAction?: (verse: QuranViewVerse, verseLabel: string) => ReactNode;
  translationNotesLabel: string;
}

/**
 * Verses rendered in document flow, which keeps every page load free of
 * layout shift and the server markup within the page-size budget.
 */
export const QURAN_FLOW_VERSES = 80;

/**
 * Renders a surah's leading verses in document flow, so the server markup has
 * its final height, and virtualizes any verses after them far below the fold.
 */
export function QuranVerseList({
  items,
  renderAction,
  translationNotesLabel,
}: Props) {
  const renderVerse = ({ id, label, verse }: VerseItem, index: number) => (
    <QuranVerseItem
      action={renderAction?.(verse, label)}
      id={id}
      isLast={index === items.length - 1}
      key={verse.number.inQuran}
      translationNotesLabel={translationNotesLabel}
      verse={verse}
      verseLabel={label}
    />
  );
  const tail = items.slice(QURAN_FLOW_VERSES);

  return (
    <div>
      {items.slice(0, QURAN_FLOW_VERSES).map(renderVerse)}
      {tail.length > 0 && (
        <WindowVirtualized>
          {tail.map((item, index) =>
            renderVerse(item, QURAN_FLOW_VERSES + index)
          )}
        </WindowVirtualized>
      )}
    </div>
  );
}
