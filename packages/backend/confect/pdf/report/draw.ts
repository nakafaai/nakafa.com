import { renderPdf } from "@repo/backend/confect/pdf/render";
import type { ReportInput } from "@repo/backend/confect/pdf/report/contract";
import { REPORT_COPY } from "@repo/backend/confect/pdf/report/copy";
import { ReportDocument } from "@repo/backend/confect/pdf/report/document";
import { Effect } from "effect";
import { createElement } from "react";

/** Draws one report card as an A4 PDF in the language of its unit. */
export const drawReportPdf = Effect.fn("pdf.report.draw")(function* (
  report: typeof ReportInput.Type
) {
  return yield* renderPdf(createElement(ReportDocument, { report }), {
    language: report.locale,
    title: `${REPORT_COPY[report.locale].title} ${report.student}`,
  });
});
