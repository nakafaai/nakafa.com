import { FunctionImpl, GroupImpl } from "@confect/server";
import recordsInternal from "@repo/backend/confect/_generated/refs/records.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationRunner,
  QueryRunner,
  StorageActionWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/records/draw.spec";
import { drawLetterPdf } from "@repo/pdf/letter/draw";
import { drawReportPdf } from "@repo/pdf/report/draw";
import { Effect, Layer } from "effect";

/** The PDF's media type. */
const PDF_TYPE = "application/pdf";

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
    const storageId = yield* (yield* StorageActionWriter).store(
      new Blob([bytes], { type: PDF_TYPE })
    );
    yield* (yield* MutationRunner)
      .runMutation(recordsInternal.prints.lock, { reportId, storageId })
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
    const storageId = yield* (yield* StorageActionWriter).store(
      new Blob([bytes], { type: PDF_TYPE })
    );
    yield* (yield* MutationRunner)
      .runMutation(recordsInternal.letters.lock, { letterId, storageId })
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
