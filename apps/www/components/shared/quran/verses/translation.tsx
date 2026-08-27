import type { QuranTranslationDocument } from "@nakafa/aksara-contracts/quran/notes";

interface Props {
  id: string;
  label: string;
  translation: QuranTranslationDocument;
  verseLabel: string;
}

/** Renders one semantic translation with accessible source-note references. */
export function QuranVerseTranslation({
  id,
  label,
  translation,
  verseLabel,
}: Props) {
  return (
    <>
      <p className="text-pretty leading-relaxed" data-quran-translation>
        {translation.segments.map((segment) =>
          segment.kind === "text" ? (
            <span key={`text:${segment.offset}`}>{segment.value}</span>
          ) : (
            <sup
              className="font-mono"
              key={`note:${segment.number}:${segment.offset}`}
            >
              <a
                aria-label={`${label} ${segment.number}`}
                className="rounded-sm px-0.5 text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          aria-label={`${label}: ${verseLabel}`}
          className="space-y-2 text-muted-foreground text-sm"
        >
          <p className="font-medium text-foreground">{label}</p>
          <ol className="space-y-2">
            {translation.notes.map((note) => (
              <li
                className="grid scroll-mt-44 grid-cols-[auto_1fr] gap-2 text-pretty leading-relaxed"
                data-quran-translation-note
                id={`${id}-translation-note-${note.number}`}
                key={note.number}
              >
                <a
                  aria-label={`${verseLabel}: ${label} ${note.number}`}
                  className="font-mono text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
