import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import type { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The addresses of the images that one exam holds, in one read, in the order the caller names
 * them. An image of another exam is refused as an access denial, so no address of another
 * school's file leaves this read. An image whose file is gone is left out of the answer. The
 * caller checks its own access to the exam first.
 */
export const addressesOf = Effect.fn("exams.addresses")(function* (
  examId: ExamsDoc["_id"],
  assets: readonly Id<"examAssets">[]
) {
  const reader = yield* DatabaseReader;
  const storage = yield* StorageReader;
  const rows = yield* Effect.forEach(assets, (id) =>
    reader
      .table("examAssets")
      .get(id)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.orDie
      )
  );
  const addresses = yield* Effect.forEach(Arr.getSomes(rows), (row) =>
    row.examId === examId
      ? storage.getUrl(row.storageId).pipe(
          Effect.map((url) => Option.some({ id: row._id, url: url.href })),
          Effect.catchTag("BlobNotFoundError", () => Effect.succeedNone)
        )
      : Effect.fail(
          new AccessDenied({ action: "exam.view", reason: "resource" })
        )
  );
  return Arr.getSomes(addresses);
});
