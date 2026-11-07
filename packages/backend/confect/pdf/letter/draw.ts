import type { LetterInput } from "@repo/backend/confect/pdf/letter/contract";
import { LetterDocument } from "@repo/backend/confect/pdf/letter/document";
import { renderPdf } from "@repo/backend/confect/pdf/render";
import { Effect } from "effect";
import { createElement } from "react";

/** The title of every SKL. */
const TITLE = "Surat Keterangan Lulus";

/** Draws one SKL as an A4 PDF in Indonesian, issued by its school under the letter's number. */
export const drawLetterPdf = Effect.fn("pdf.letter.draw")(function* (
  letter: typeof LetterInput.Type
) {
  return yield* renderPdf(createElement(LetterDocument, { letter }), {
    brand: { _tag: "school", name: letter.school, note: `NPSN ${letter.npsn}` },
    identifier: letter.number,
    issuer: letter.school,
    language: "id",
    name: `${TITLE} ${letter.student}`,
    title: TITLE,
  });
});
