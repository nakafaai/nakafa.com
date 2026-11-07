import { FunctionImpl, GroupImpl } from "@confect/server";
import recordsInternal from "@repo/backend/confect/_generated/refs/records.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { storeFile } from "@repo/backend/confect/bucket/stored";
import { drawLetterPdf } from "@repo/backend/confect/pdf/letter/draw";
import { drawReportPdf } from "@repo/backend/confect/pdf/report/draw";
import spec from "@repo/backend/confect/records/draw.spec";
import { Effect, Layer } from "effect";

/** The PDF's media type. */
const PDF_TYPE = "application/pdf";

/** Stores a drawn PDF in the bucket. A record's PDF is small and charges the bucket alone; a full bucket is a defect of the run. */
const storePdf = (bytes: Uint8Array) =>
  storeFile(
    { byteSize: bytes.byteLength, contentType: PDF_TYPE, tenantId: null },
    bytes
  ).pipe(Effect.orDie);

/** Draws an approved report's PDF, stores it, and locks the report with it. */
const report = FunctionImpl.make(
  databaseSchema,
  spec,
  "report",
  Effect.fn("records.draw.report")(function* ({ reportId }) {
    const copy = yield* (yield* QueryRunner)
      .runQuery(recordsInternal.prints.printable, { reportId })
      .pipe(Effect.orDie);
    const bytes = yield* drawReportPdf(copy).pipe(Effect.orDie);
    const fileId = yield* storePdf(bytes);
    yield* (yield* MutationRunner)
      .runMutation(recordsInternal.prints.lock, { fileId, reportId })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Draws an issued SKL's PDF, stores it, and locks the letter with it. */
const letter = FunctionImpl.make(
  databaseSchema,
  spec,
  "letter",
  Effect.fn("records.draw.letter")(function* ({ letterId }) {
    const copy = yield* (yield* QueryRunner)
      .runQuery(recordsInternal.letters.printable, { letterId })
      .pipe(Effect.orDie);
    const bytes = yield* drawLetterPdf(copy).pipe(Effect.orDie);
    const fileId = yield* storePdf(bytes);
    yield* (yield* MutationRunner)
      .runMutation(recordsInternal.letters.lock, { fileId, letterId })
      .pipe(Effect.orDie);
    return null;
  })
);

/** The drawing of a school's records. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(report),
  Layer.provide(letter),
  GroupImpl.finalize
);
