"use client";

import type { AssessmentDocument } from "@nakafa/aksara-contracts/assessment/document";
import { documentMarkdown } from "@repo/contents/llms/document";
import { spokenText } from "@repo/design-system/lib/markdown/spoken";
import { useTranslations } from "use-intl";
import { AssessmentLine } from "@/components/assessment/document";

/**
 * One response label, an option's, a statement's, or a column's, read as one line, which says whether it
 * is correct once the answers are revealed. The label names its control by its own words: the drawn
 * document is hidden from assistive technology, and its words, each formula spoken as KaTeX reads it,
 * stand beside it for screen readers. A label drawn only as math would otherwise name nothing, since
 * its formula is MathML, which an accessible name does not read.
 */
export function TryoutResponseLabel({
  correctness,
  document,
}: {
  readonly correctness?: boolean | undefined;
  readonly document: Pick<AssessmentDocument, "content">;
}) {
  const t = useTranslations("Tryouts");

  return (
    <>
      <div aria-hidden="true">
        <AssessmentLine document={document} />
      </div>
      <span className="sr-only">{spokenText(documentMarkdown(document))}</span>
      {correctness === undefined ? null : (
        <span className="sr-only">
          {t(correctness ? "correct" : "incorrect")}
        </span>
      )}
    </>
  );
}
