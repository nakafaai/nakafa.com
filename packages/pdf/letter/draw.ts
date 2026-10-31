import type { LetterInput } from "@repo/pdf/letter/contract";
import { LetterDocument } from "@repo/pdf/letter/document";
import { renderPdf } from "@repo/pdf/render";
import { Effect } from "effect";
import { createElement } from "react";

/** Draws one SKL as an A4 PDF in Indonesian. */
export const drawLetterPdf = Effect.fn("pdf.letter.draw")(function* (
  letter: typeof LetterInput.Type
) {
  return yield* renderPdf(createElement(LetterDocument, { letter }), {
    language: "id",
    title: `Surat Keterangan Lulus ${letter.student}`,
  });
});
