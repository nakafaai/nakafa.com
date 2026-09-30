import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import type { backfillReceiptValidator } from "@repo/backend/confect/contentRelease/artifact/backfill.spec";
import { loadArtifactFacts } from "@repo/backend/confect/contentRelease/artifact/facts";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  ARTIFACT_PAGE_BYTES,
  ROLLBACK_RETENTION_MS,
} from "@repo/backend/confect/contentRelease/spec";
import { Clock, Effect, type Schema } from "effect";

type BackfillReceipt = Schema.Schema.Type<typeof backfillReceiptValidator>;

/** Maximum artifact bodies migrated by one backfill transaction. */
const BACKFILL_PAGE_COUNT = 32;

/** Maximum backfill transactions executed by one action run. */
const BACKFILL_RUN_PAGES = 256;

/** Gives one body its facts and drops the retention fields it carried. */
const migrateBody = Effect.fn("contentRelease.migrateArtifactBody")(function* (
  body: Docs["contentArtifacts"],
  now: number
) {
  const writer = yield* DatabaseWriter;
  const facts = yield* loadArtifactFacts(body.artifactHash);
  if (facts && facts.artifactId !== body._id) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Artifact ${body.artifactHash} has facts for another stored body.`
    );
  }
  if (!facts) {
    yield* writer
      .table("contentArtifactFacts")
      .insert({
        artifactHash: body.artifactHash,
        artifactId: body._id,
        artifactJsonHash: yield* hashText(
          `artifact ${body.artifactHash} bytes`,
          body.artifactJson
        ),
        // Orphaning before this backfill never reached artifact facts, so
        // every migrated artifact keeps at least one full window from now.
        retainUntil: Math.max(
          body.retainUntil ?? 0,
          now + ROLLBACK_RETENTION_MS
        ),
      })
      .pipe(Effect.orDie);
  }
  const legacy = body.createdAt !== undefined || body.retainUntil !== undefined;
  if (legacy) {
    yield* writer
      .table("contentArtifacts")
      .replace(body._id, {
        artifactHash: body.artifactHash,
        artifactJson: body.artifactJson,
      })
      .pipe(Effect.orDie);
  }
  return {
    created: facts ? 0 : 1,
    stripped: legacy ? 1 : 0,
  };
});

/** Migrates one bounded body page; a complete second pass changes nothing. */
export const backfillPage = Effect.fn("contentRelease.backfillArtifactFacts")(
  function* (cursor: null | string) {
    const now = yield* Clock.currentTimeMillis;
    const page = yield* (yield* DatabaseReader)
      .table("contentArtifacts")
      .index("by_artifactHash")
      .paginate({
        cursor,
        maximumBytesRead: ARTIFACT_PAGE_BYTES,
        maximumRowsRead: BACKFILL_PAGE_COUNT,
        numItems: BACKFILL_PAGE_COUNT,
      })
      .pipe(Effect.orDie);
    let created = 0;
    let stripped = 0;
    for (const body of page.page) {
      const migrated = yield* migrateBody(body, now);
      created += migrated.created;
      stripped += migrated.stripped;
    }
    return {
      created,
      cursor: page.isDone ? null : page.continueCursor,
      done: page.isDone,
      scanned: page.page.length,
      stripped,
    } satisfies BackfillReceipt;
  }
);

/** Runs bounded backfill pages from one cursor and reports where to resume. */
export const backfillRun = Effect.fn("contentRelease.runArtifactFactsBackfill")(
  function* (cursor: null | string) {
    const runMutation = yield* MutationRunner;
    let receipt: BackfillReceipt = {
      created: 0,
      cursor,
      done: false,
      scanned: 0,
      stripped: 0,
    };
    for (let run = 0; run < BACKFILL_RUN_PAGES && !receipt.done; run += 1) {
      const page = yield* runMutation(
        refs.internal.contentRelease.artifact.backfill.page,
        { cursor: receipt.cursor }
      ).pipe(Effect.catchTag("SchemaError", Effect.die));
      receipt = {
        created: receipt.created + page.created,
        cursor: page.cursor,
        done: page.done,
        scanned: receipt.scanned + page.scanned,
        stripped: receipt.stripped + page.stripped,
      };
    }
    return receipt;
  }
);
