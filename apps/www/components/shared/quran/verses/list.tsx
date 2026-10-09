"use client";

import type { QuranViewVerse } from "@repo/backend/client/quran/view";
import { Array as Arr, Option } from "effect";
import {
  QuranInterpretationButton,
  QuranInterpretationLink,
} from "@/components/shared/quran/interpretation/button";
import { QuranText } from "@/components/shared/quran/text";
import { useQuranVerses } from "@/components/shared/quran/verses/context";
import { QURAN_FLOW_VERSES } from "@/components/shared/quran/verses/flow";
import {
  QuranVerse,
  QuranVerseHeading,
} from "@/components/shared/quran/verses/item";
import { QuranTranslation } from "@/components/shared/quran/verses/translation";
import { WindowVirtualized } from "@/components/shared/quran/verses/virtual";

interface QuranVerseListProps {
  items: readonly {
    id: string;
    label: string;
    verse: QuranViewVerse;
  }[];
}

type VerseItem = QuranVerseListProps["items"][number];

/**
 * Renders a surah's leading verses in document flow, so the server markup has
 * its final height, and virtualizes any verses after them far below the fold.
 * Verses arrive once as data, so the page payload carries each verse's text
 * rather than a rendered element tree for every verse.
 */
export function QuranVerseList({ items }: QuranVerseListProps) {
  const last = Arr.last(items);
  const tail = Arr.drop(items, QURAN_FLOW_VERSES);

  return (
    <div>
      {Arr.map(Arr.take(items, QURAN_FLOW_VERSES), (item) => (
        <QuranSurahVerse
          isLast={Option.exists(last, (value) => value === item)}
          item={item}
          key={item.verse.number.inQuran}
        />
      ))}
      {tail.length > 0 ? (
        <WindowVirtualized data={tail}>
          {(item) => (
            <QuranSurahVerse
              isLast={Option.exists(last, (value) => value === item)}
              item={item}
              key={item.verse.number.inQuran}
            />
          )}
        </WindowVirtualized>
      ) : null}
    </div>
  );
}

/** One verse: its heading and interpretation control, Arabic, and translation. */
function QuranSurahVerse({
  isLast,
  item,
}: {
  isLast: boolean;
  item: VerseItem;
}) {
  const { id, label, verse } = item;

  return (
    <QuranVerse isLast={isLast} number={verse.number.inSurah}>
      <QuranVerseHeading id={id} label={label} number={verse.number.inSurah}>
        <QuranVerseInterpretation
          verseLabel={label}
          verseNumber={verse.number.inSurah}
        />
      </QuranVerseHeading>
      <QuranText data-quran-arabic>{verse.arabic}</QuranText>
      <QuranVerseTranslation item={item} />
    </QuranVerse>
  );
}

/** The interpretation control the surah's Tafsir edition supports. */
function QuranVerseInterpretation({
  verseLabel,
  verseNumber,
}: {
  verseLabel: string;
  verseNumber: number;
}) {
  const interpretationLabel = useQuranVerses(
    (value) => value.interpretationLabel
  );
  const tafsirAccess = useQuranVerses((value) => value.tafsirAccess);
  const label = `${interpretationLabel}: ${verseLabel}`;

  return tafsirAccess.kind === "embedded" ? (
    <QuranInterpretationButton label={label} verseNumber={verseNumber} />
  ) : (
    <QuranInterpretationLink
      href={tafsirAccess.source.sourceUrl}
      label={label}
    />
  );
}

/** A verse's translation with its source notes. */
function QuranVerseTranslation({ item }: { item: VerseItem }) {
  const translationNotesLabel = useQuranVerses(
    (value) => value.translationNotesLabel
  );

  return (
    <QuranTranslation
      id={item.id}
      label={translationNotesLabel}
      subjectLabel={item.label}
      translation={item.verse.translation}
    />
  );
}
