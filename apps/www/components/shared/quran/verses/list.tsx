import type { QuranViewVerse } from "@repo/backend/client/quran/view";
import type { ReactNode } from "react";
import { QuranVerseItem } from "@/components/shared/quran/verses/item";

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
 * Renders every verse in document flow, so the server markup already has its
 * final height. Off-screen verses skip rendering work through content-visibility.
 */
export function QuranVerseList({
  items,
  renderAction,
  translationNotesLabel,
}: Props) {
  return (
    <div>
      {items.map(({ id, label, verse }, index) => (
        <QuranVerseItem
          action={renderAction?.(verse, label)}
          id={id}
          isLast={index === items.length - 1}
          key={verse.number.inQuran}
          translationNotesLabel={translationNotesLabel}
          verse={verse}
          verseLabel={label}
        />
      ))}
    </div>
  );
}
