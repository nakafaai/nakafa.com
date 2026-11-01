import type { QuranTranslationDocument } from "@nakafa/aksara-contracts/quran/notes";
import { Array as Arr } from "effect";

interface Props {
  id: string;
  label: string;
  proseClassName?: string;
  subjectLabel: string;
  translation: QuranTranslationDocument;
}

/** Renders one semantic translation with accessible source-note references. */
export function QuranTranslation({
  id,
  label,
  proseClassName,
  subjectLabel,
  translation,
}: Props) {
  return (
    <>
      <p
        className={proseClassName ?? "leading-relaxed text-pretty"}
        data-quran-translation
      >
        {Arr.map(translation.segments, (segment) =>
          segment.kind === "text" ? (
            <span key={`text:${segment.offset}`}>{segment.value}</span>
          ) : (
            <sup
              className="font-mono"
              key={`note:${segment.number}:${segment.offset}`}
            >
              <a
                aria-label={`${label} ${segment.number}`}
                className="text-primary decoration-primary/40 hover:decoration-primary focus-visible:ring-ring -mx-2 rounded-sm px-2.5 py-1.5 underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
                href={`#${id}-translation-note-${segment.number}`}
                id={`${id}-translation-note-reference-${segment.number}-${segment.offset}`}
                role="doc-noteref"
              >
                {segment.number}
              </a>
            </sup>
          )
        )}
      </p>
      {translation.notes.length > 0 ? (
        <aside
          aria-label={`${label}: ${subjectLabel}`}
          className="text-muted-foreground space-y-2 text-sm"
        >
          <ol className="space-y-2">
            {Arr.map(translation.notes, (note) => (
              <li
                className="quran-verse-anchor grid grid-cols-[auto_1fr] gap-2 leading-relaxed text-pretty"
                data-quran-translation-note
                id={`${id}-translation-note-${note.number}`}
                key={note.number}
              >
                <a
                  aria-label={`${note.number}. ${subjectLabel}: ${label}`}
                  className="text-primary decoration-primary/40 hover:decoration-primary focus-visible:ring-ring -mx-1.5 -my-0.5 px-1.5 py-0.5 font-mono underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
                  href={`#${id}-translation-note-reference-${note.number}-${note.referenceOffset}`}
                  role="doc-backlink"
                >
                  {note.number}.
                </a>
                <span className="whitespace-pre-line">{note.text}</span>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </>
  );
}
