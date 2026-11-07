import type { ClassroomLibraryDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  type LibraryView,
  libraryField,
} from "@repo/backend/confect/classroom/library/item";
import { starredBy } from "@repo/backend/confect/classroom/library/star";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, HashSet, Match } from "effect";

/**
 * The views of some library items for a reader of the allowed class: each title and link opened with the school
 * key, each author's name read once, and the reader's own stars. A file carries no address: it is signed for each
 * opening (ADR 0028).
 */
export const libraryViews = Effect.fn("classroom.library.views")(function* (
  rows: readonly ClassroomLibraryDoc[]
) {
  const row = yield* Class;
  const { person } = yield* Member;
  const reader = yield* DatabaseReader;
  const keys = yield* schoolKeys(row.tenantId);
  const stars = yield* starredBy(row._id, person._id);
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
      const shown = {
        author: author.name,
        clientKey: item.clientKey,
        createdAt: item.createdAt,
        folderId: item.folderId ?? null,
        id: item._id,
        starred: HashSet.has(stars, item._id),
        title: yield* openText(
          keys,
          libraryField(item, "sealedTitle"),
          item.sealedTitle
        ),
        trashedAt: item.trashedAt ?? null,
      };
      return yield* Match.value(item).pipe(
        Match.discriminatorsExhaustive("kind")({
          file: (file): Effect.Effect<typeof LibraryView.Type> =>
            Effect.succeed({
              ...shown,
              address: null,
              byteSize: file.byteSize,
              kind: file.contentType === "application/pdf" ? "pdf" : "image",
            }),
          link: (link) =>
            openText(
              keys,
              libraryField(link, "sealedAddress"),
              link.sealedAddress
            ).pipe(
              Effect.map((address): typeof LibraryView.Type => ({
                ...shown,
                address,
                byteSize: null,
                kind: "link",
              }))
            ),
        })
      );
    }).pipe(Effect.orDie)
  );
});
