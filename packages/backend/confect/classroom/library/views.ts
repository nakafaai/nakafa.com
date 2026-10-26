import type { ClassroomLibraryDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  type LibraryKind,
  type LibraryView,
  libraryField,
} from "@repo/backend/confect/classroom/library/item";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Match } from "effect";

/**
 * The views of some library items for a reader of the allowed class: each title
 * and link opened with the school key, each author's name read once, and each
 * file's address read from storage for this read alone.
 */
export const libraryViews = Effect.fn("classroom.library.views")(function* (
  rows: readonly ClassroomLibraryDoc[]
) {
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const storage = yield* StorageReader;
  const keys = yield* schoolKeys(row.tenantId);
  const authors = yield* Effect.forEach(
    Arr.dedupe(Arr.map(rows, (item) => item.authorId)),
    (authorId) => reader.table("tenantPeople").get(authorId),
    { concurrency: "unbounded" }
  ).pipe(Effect.orDie);
  return yield* Effect.forEach(rows, (item) =>
    Effect.gen(function* () {
      // Every author was read above, so an item without its author is a defect.
      const author = yield* Effect.fromOption(
        Arr.findFirst(authors, (candidate) => candidate._id === item.authorId)
      );
      const title = yield* openText(
        keys,
        libraryField(item, "sealedTitle"),
        item.sealedTitle
      );
      const shown = (
        address: string | null,
        byteSize: number | null,
        kind: typeof LibraryKind.Type
      ): typeof LibraryView.Type => ({
        address,
        author: author.name,
        byteSize,
        clientKey: item.clientKey,
        createdAt: item.createdAt,
        id: item._id,
        kind,
        title,
      });
      return yield* Match.value(item).pipe(
        Match.discriminatorsExhaustive("kind")({
          file: (file) =>
            storage.getUrl(file.storageId).pipe(
              Effect.map((url) => url.href),
              Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)),
              Effect.map((address) =>
                shown(
                  address,
                  file.byteSize,
                  file.contentType === "application/pdf" ? "pdf" : "image"
                )
              )
            ),
          link: (link) =>
            openText(
              keys,
              libraryField(link, "sealedAddress"),
              link.sealedAddress
            ).pipe(Effect.map((address) => shown(address, null, "link"))),
        })
      );
    }).pipe(Effect.orDie)
  );
});
