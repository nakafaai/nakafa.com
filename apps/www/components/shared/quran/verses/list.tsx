import type {
  QuranViewTafsirAccess,
  QuranViewVerse,
} from "@repo/backend/client/quran/view";
import {
  QuranInterpretationButton,
  QuranInterpretationLink,
} from "@/components/shared/quran/interpretation/button";
import { QuranVerseItem } from "@/components/shared/quran/verses/item";
import { WindowVirtualized } from "@/components/shared/quran/verses/virtual";

interface VerseItem {
  id: string;
  label: string;
  verse: QuranViewVerse;
}

interface Props {
  interpretationLabel: string;
  items: readonly VerseItem[];
  tafsirAccess: QuranViewTafsirAccess;
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
  interpretationLabel,
  items,
  tafsirAccess,
  translationNotesLabel,
}: Props) {
  const last = items.at(-1);
  const tail = items.slice(QURAN_FLOW_VERSES);

  return (
    <div>
      {items.slice(0, QURAN_FLOW_VERSES).map((item) => (
        <QuranSurahVerse
          interpretationLabel={interpretationLabel}
          isLast={item === last}
          item={item}
          key={item.verse.number.inQuran}
          tafsirAccess={tafsirAccess}
          translationNotesLabel={translationNotesLabel}
        />
      ))}
      {tail.length > 0 ? (
        <WindowVirtualized>
          {tail.map((item) => (
            <QuranSurahVerse
              interpretationLabel={interpretationLabel}
              isLast={item === last}
              item={item}
              key={item.verse.number.inQuran}
              tafsirAccess={tafsirAccess}
              translationNotesLabel={translationNotesLabel}
            />
          ))}
        </WindowVirtualized>
      ) : null}
    </div>
  );
}

/** One verse with the interpretation control its Tafsir edition supports. */
function QuranSurahVerse({
  interpretationLabel,
  isLast,
  item,
  tafsirAccess,
  translationNotesLabel,
}: Omit<Props, "items"> & { isLast: boolean; item: VerseItem }) {
  const label = `${interpretationLabel}: ${item.label}`;

  return (
    <QuranVerseItem
      action={
        tafsirAccess.kind === "embedded" ? (
          <QuranInterpretationButton
            label={label}
            verseNumber={item.verse.number.inSurah}
          />
        ) : (
          <QuranInterpretationLink
            href={tafsirAccess.source.sourceUrl}
            label={label}
          />
        )
      }
      id={item.id}
      isLast={isLast}
      translationNotesLabel={translationNotesLabel}
      verse={item.verse}
      verseLabel={item.label}
    />
  );
}
