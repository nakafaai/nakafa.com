import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadSearchOwner } from "@repo/backend/confect/contentRelease/search/owner";
import { loadSearchArtifact } from "@repo/backend/confect/contentRelease/search/sync";
import { resolveSearchProjection } from "@repo/backend/confect/contentRelease/search/verify";
import { sourceVersion } from "@repo/backend/confect/contents/sections/draft";
import {
  LESSON_PAGE_BYTES,
  LESSONS_PER_STEP,
} from "@repo/backend/confect/contents/sections/limits";
import type {
  lessonsInputValidator,
  lessonValidator,
} from "@repo/backend/confect/contents/sections/schema";
import { holdsVersion } from "@repo/backend/confect/contents/sections/source";
import { Array as Arr, Effect, Option } from "effect";

type SearchOwner = NonNullable<
  Effect.Success<ReturnType<typeof loadSearchOwner>>
>;

/**
 * Reads one lesson or article of the active release from its search row: the
 * row is checked against the active projection and the artifact against the
 * projection, and the authored source comes with the facts a section needs and
 * the version it is made at. A lesson whose sections the index holds at that
 * version already is passed over without reading its artifact, which is the
 * large part of it, because its source has not changed.
 */
const readLesson = Effect.fn("contents.sections.readLesson")(function* (
  row: Docs["contentIndex"],
  owner: SearchOwner
) {
  const resolved = yield* resolveSearchProjection(row, owner);
  if (!resolved.artifactHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active lesson ${row.contentKey}/${row.appLocale} lost its artifact.`
    );
  }
  const version = sourceVersion(row.projectionHash, resolved.artifactHash);
  if (yield* holdsVersion(row, version)) {
    return Option.none<typeof lessonValidator.Type>();
  }
  const artifact = yield* loadSearchArtifact(resolved, resolved.artifactHash);
  return Option.some({
    appLocale: row.appLocale,
    contentKey: row.contentKey,
    publicPath: row.publicPath,
    rawMdx: artifact.payload.rawMdx,
    section: resolved.projection.kind === "article" ? "articles" : "material",
    title: resolved.projection.metadata.title,
    version,
  } satisfies typeof lessonValidator.Type);
});

/**
 * Reads the next lessons of the active release in route order, after the
 * lesson that `cursor` follows, and gives those whose sections the index lacks
 * or holds at another version. The answer is stale when no release is active
 * or `releaseId` names another release than the active one, so a build that
 * began for an earlier release stops instead of mixing two releases.
 */
export const readLessons = Effect.fn("contents.sections.readLessons")(
  function* (input: typeof lessonsInputValidator.Type) {
    const owner = yield* loadSearchOwner();
    if (
      owner === null ||
      (input.releaseId !== undefined && input.releaseId !== owner.releaseId)
    ) {
      return { kind: "stale" as const };
    }
    const database = yield* DatabaseReader;
    const page = yield* database
      .table("contentIndex")
      .index("by_slot_and_appLocale_and_family_and_publicPath", (index) =>
        index.eq("slot", owner.slot)
      )
      .paginate({
        cursor: input.cursor,
        maximumBytesRead: LESSON_PAGE_BYTES,
        maximumRowsRead: LESSONS_PER_STEP,
        numItems: LESSONS_PER_STEP,
      })
      .pipe(Effect.orDie);
    const lessons = Arr.getSomes(
      yield* Effect.forEach(page.page, (row) => readLesson(row, owner))
    );
    return {
      kind: "page" as const,
      lessons,
      next: page.isDone ? null : page.continueCursor,
      releaseId: owner.releaseId,
      unchanged: page.page.length - lessons.length,
    };
  }
);
