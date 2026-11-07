import { FunctionImpl } from "@confect/server";
import type { ClassroomLibraryDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { objectAddress } from "@repo/backend/confect/bucket/sign";
import { spendOperations } from "@repo/backend/confect/bucket/use";
import { Class } from "@repo/backend/confect/classroom/access";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { classItem } from "@repo/backend/confect/classroom/library/edit";
import {
  type LibraryFileType,
  libraryField,
} from "@repo/backend/confect/classroom/library/item";
import { starsOf } from "@repo/backend/confect/classroom/library/star";
import {
  classFolders,
  hiddenFolders,
} from "@repo/backend/confect/classroom/library/tree";
import { libraryViews } from "@repo/backend/confect/classroom/library/views";
import spec from "@repo/backend/confect/classroom/library.spec";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { openText } from "@repo/backend/confect/vault/text";
import {
  Array as Arr,
  Effect,
  HashSet,
  Order,
  Result,
  String as Str,
  Struct,
} from "effect";

/** How long the address of one opening lives. */
const OPEN_SECONDS = 300;

/** The newest items a search reads, whose titles are sealed and so are opened to be compared. */
const SEARCH_SCAN = 500;

/** The most results one search answers. */
const SEARCH_RESULTS = 50;

/** One page of a folder of the class library, or of the items at its top, outside the trash, newest first. */
export const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.library.list")(function* ({ folderId, paginationOpts }) {
    const row = yield* Class;
    const found = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .index(
        "by_classId_and_folderId_and_trashedAt",
        (query) =>
          query
            .eq("classId", row._id)
            .eq("folderId", folderId ?? undefined)
            .eq("trashedAt", undefined),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, { page: yield* libraryViews(found.page) });
  })
);

/** One page of the items in the trash, the last one trashed first. A folder's own row shows its contents. */
export const trashed = FunctionImpl.make(
  databaseSchema,
  spec,
  "trashed",
  Effect.fn("classroom.library.trashed")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const found = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .index(
        "by_classId_and_trashedAt",
        (query) => query.eq("classId", row._id).gt("trashedAt", 0),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, { page: yield* libraryViews(found.page) });
  })
);

/** The items of the class that the reader can see: outside the trash and outside every trashed folder. */
const visibleItems = Effect.fn("classroom.library.visible")(function* () {
  const row = yield* Class;
  const hidden = hiddenFolders(yield* classFolders(row._id));
  return (item: ClassroomLibraryDoc) =>
    item.trashedAt === undefined &&
    (item.folderId === undefined || !HashSet.has(hidden, item.folderId));
});

/** The items the reader starred, outside the trash, newest first. */
export const starred = FunctionImpl.make(
  databaseSchema,
  spec,
  "starred",
  Effect.fn("classroom.library.starred")(function* () {
    const row = yield* Class;
    const { person } = yield* Member;
    const reader = yield* DatabaseReader;
    const stars = yield* starsOf(row._id, person._id);
    const items = Arr.getSomes(
      yield* Effect.forEach(
        Arr.filterMap(stars, (star) =>
          star.kind === "item" ? Result.succeed(star.itemId) : Result.failVoid
        ),
        (itemId) =>
          reader.table("classroomLibrary").get(itemId).pipe(Effect.option),
        { concurrency: "unbounded" }
      )
    );
    const shows = yield* visibleItems();
    return yield* libraryViews(
      Arr.sort(
        Arr.filter(items, shows),
        Order.flip(
          Order.mapInput(
            Order.Number,
            (item: ClassroomLibraryDoc) => item.createdAt
          )
        )
      )
    );
  })
);

/** The items whose title holds the text, without case, among the newest items outside the trash. */
export const search = FunctionImpl.make(
  databaseSchema,
  spec,
  "search",
  Effect.fn("classroom.library.search")(function* ({ text }) {
    const row = yield* Class;
    const keys = yield* schoolKeys(row.tenantId);
    const rows = yield* (yield* DatabaseReader)
      .table("classroomLibrary")
      .index("by_classId", (query) => query.eq("classId", row._id), "desc")
      .take(SEARCH_SCAN)
      .pipe(Effect.orDie);
    const shows = yield* visibleItems();
    const wanted = Str.toLowerCase(Str.trim(text));
    const found = yield* Effect.filter(Arr.filter(rows, shows), (item) =>
      openText(keys, libraryField(item, "sealedTitle"), item.sealedTitle).pipe(
        Effect.map((title) => Str.includes(wanted)(Str.toLowerCase(title))),
        Effect.orDie
      )
    );
    return yield* libraryViews(Arr.take(found, SEARCH_RESULTS));
  })
);

/** The extension a saved file takes from its type. */
const EXTENSIONS = {
  "application/pdf": ".pdf",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} satisfies Record<typeof LibraryFileType.Type, string>;

/**
 * Opens one item outside the trash: a link answers its address, a file an address signed for this opening alone
 * that lives five minutes, shown in the browser or saved under its title. Each file opening spends one read of
 * the day's free operations.
 */
export const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("classroom.library.open")(function* ({ download, itemId }) {
    const row = yield* Class;
    const item = yield* classItem(itemId);
    if (item.trashedAt !== undefined) {
      return yield* new AccessDenied({
        action: "forum.read",
        reason: "resource",
      });
    }
    const keys = yield* schoolKeys(row.tenantId);
    if (item.kind === "link") {
      return yield* openText(
        keys,
        libraryField(item, "sealedAddress"),
        item.sealedAddress
      ).pipe(Effect.orDie);
    }
    yield* spendOperations("bucketRead", 1);
    const title = yield* openText(
      keys,
      libraryField(item, "sealedTitle"),
      item.sealedTitle
    ).pipe(Effect.orDie);
    const name = `${title}${EXTENSIONS[item.contentType]}`;
    return yield* objectAddress(item.objectKey, {
      expiresSeconds: OPEN_SECONDS,
      method: "GET",
      query: {
        "response-content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "response-content-type": item.contentType,
      },
    });
  })
);
