import { renderPdf } from "@repo/backend/confect/pdf/render";
import type { ReportInput } from "@repo/backend/confect/pdf/report/contract";
import { REPORT_COPY } from "@repo/backend/confect/pdf/report/copy";
import { ReportDocument } from "@repo/backend/confect/pdf/report/document";
import { Effect, String as Str } from "effect";
import { createElement } from "react";

/**
 * Draws one report card as an A4 PDF in the language of its unit, issued by its
 * school and known by the start of the hash its public check reads.
 */
export const drawReportPdf = Effect.fn("pdf.report.draw")(function* (
  report: typeof ReportInput.Type
) {
  const title = REPORT_COPY[report.locale].title;
  return yield* renderPdf(createElement(ReportDocument, { report }), {
    brand: { _tag: "school", name: report.school },
    identifier: Str.takeLeft(report.hash, 12),
    issuer: report.school,
    language: report.locale,
    name: `${title} ${report.student}`,
    title,
  });
});
