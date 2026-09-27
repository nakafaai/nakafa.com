import { QueryStream } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import {
  articlePublicationCursor,
  decodePublicationPosition,
} from "@repo/backend/content/article/cursor";
import { encodeArticlePublicationCursor } from "@repo/contents/publication";
import type { PaginationOptions } from "convex/server";
import { Effect, Predicate } from "effect";

type AppLocale = Docs["articleCatalog"]["appLocale"];

/** Reads current articles in truthful newest-first order. */
export const readOrderedArticles = Effect.fn(
  "contentRelease.readOrderedArticles"
)(function* (
  slot: ModelSlot,
  appLocale: AppLocale,
  category: string | null,
  limit: number
) {
  const catalog = (yield* DatabaseReader).table("articleCatalog");
  const query =
    category === null
      ? catalog.index(
          "by_slot_and_appLocale_and_datePublished_and_contentKey",
          (index) =>
            index
              .eq("slot", slot)
              .eq("appLocale", appLocale)
              .gte("datePublished", ""),
          "desc"
        )
      : catalog.index(
          "by_slot_appLocale_category_datePublished_contentKey",
          (index) =>
            index
              .eq("slot", slot)
              .eq("appLocale", appLocale)
              .eq("category", category)
              .gte("datePublished", ""),
          "desc"
        );
  return yield* query.take(limit).pipe(Effect.orDie);
});

/** Read one bounded native stream while keeping the deployed portable cursor. */
export const paginateArticles = Effect.fn("contentRelease.paginateArticles")(
  function* (
    slot: ModelSlot,
    appLocale: AppLocale,
    category: string,
    options: PaginationOptions & {
      maximumBytesRead: number;
      maximumRowsRead: number;
    }
  ) {
    const position = yield* decodePublicationPosition(options.cursor);
    if (
      position !== null &&
      (position[0] !== slot ||
        position[1] !== appLocale ||
        position[2] !== category)
    ) {
      return yield* new ReleaseError({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Article publication cursor belongs to another query.",
      });
    }
    const publication = (yield* DatabaseReader)
      .table("articleCatalog")
      .stream(
        "by_slot_appLocale_category_datePublished_contentKey",
        (index) =>
          index
            .eq("slot", slot)
            .eq("appLocale", appLocale)
            .eq("category", category)
            .gte("datePublished", ""),
        "desc"
      );
    const remaining =
      position === null
        ? publication
        : QueryStream.narrow(publication, {
            start: {
              keyValues: [position[3], position[4]],
              inclusive: false,
            },
          });
    const scanned = yield* QueryStream.paginate(remaining, {
      cursor: null,
      maximumBytesRead: options.maximumBytesRead,
      maximumRowsRead: options.maximumRowsRead,
      numItems: options.numItems + 1,
    }).pipe(
      Effect.catchTags({
        DocumentDecodeError: () =>
          Effect.fail(
            new ReleaseError({
              code: "CONTENT_RELEASE_INTEGRITY",
              message: "Article publication contains an invalid stored row.",
            })
          ),
        ReadBudgetExceededError: () =>
          Effect.fail(
            new ReleaseError({
              code: "CONTENT_RELEASE_LIMIT",
              message:
                "Article publication cannot advance within its read budget.",
            })
          ),
      })
    );
    const page = scanned.page.slice(0, options.numItems);
    const last = page.at(-1);
    const split = Predicate.isNullish(scanned.splitCursor)
      ? undefined
      : page[Math.floor((page.length - 1) / 2)];
    const hasMore = scanned.page.length > options.numItems;
    return {
      continueCursor: last
        ? articlePublicationCursor(last)
        : (options.cursor ?? encodeArticlePublicationCursor("[]")),
      isDone: hasMore ? false : scanned.isDone,
      page,
      ...(scanned.pageStatus === undefined
        ? {}
        : {
            pageStatus: scanned.pageStatus,
          }),
      ...(split
        ? {
            splitCursor: articlePublicationCursor(split),
          }
        : {}),
    };
  }
);
