import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PROGRAM_RELATED_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { loadProgramRouteRow } from "@repo/backend/convex/contentRelease/program/model";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { verifyCurriculum } from "@repo/backend/convex/contentRelease/program/verify";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect } from "effect";

interface ProgramContextInput {
  readonly materialKey: string;
  readonly nodeKey: string;
  readonly parentPath: string;
  readonly programKey: string;
  readonly publicPath: string;
}

/** Checks whether one curriculum mapping owns the exact material target. */
function ownsMaterial(
  context: Effect.Effect.Success<ReturnType<typeof verifyCurriculum>>,
  group: Effect.Effect.Success<ReturnType<typeof verifyCurriculum>>,
  parent: Effect.Effect.Success<ReturnType<typeof verifyCurriculum>>,
  input: ProgramContextInput
) {
  return (
    context.materialContextNodeKey === input.nodeKey &&
    context.materialContextParentPath === parent.publicPath &&
    context.materialContextPublicPath === group.publicPath &&
    context.materialKey === input.materialKey &&
    context.programKey === input.programKey &&
    (context.canonicalPath === input.publicPath ||
      context.canonicalPath === input.parentPath)
  );
}

/** Resolves one valid curriculum return context for a material identity. */
export const readProgramContext = Effect.fn(
  "contentRelease.readProgramContext"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"curriculumRoutes">["locale"],
  input: ProgramContextInput,
  expectedActiveReleaseId?: string | null
) {
  const active = yield* loadActiveIdentity(ctx);
  yield* requireExpectedActiveRelease(
    active,
    expectedActiveReleaseId,
    "Curriculum context"
  );
  const owner = yield* loadProgramOwner(ctx, locale);
  if (!(owner.managed && owner.selected)) {
    return { context: null, managed: false };
  }
  const { snapshotId } = owner.selected;
  const storedGroup = yield* Effect.promise(() =>
    ctx.db
      .query("curriculumRoutes")
      .withIndex(
        "by_snapshotId_and_locale_and_programKey_and_nodeKey",
        (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("locale", locale)
            .eq("programKey", input.programKey)
            .eq("nodeKey", input.nodeKey)
      )
      .unique()
  );
  if (!storedGroup) {
    return { context: null, managed: true };
  }
  const group = yield* verifyCurriculum(storedGroup, snapshotId);
  if (!group.parentPath) {
    return { context: null, managed: true };
  }
  const storedParent = yield* loadProgramRouteRow(
    ctx,
    snapshotId,
    locale,
    group.parentPath
  );
  if (!storedParent) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Curriculum context ${input.programKey}/${input.nodeKey} lost parent ${group.parentPath}.`
    );
  }
  const parent = yield* verifyCurriculum(storedParent, snapshotId);
  if (!(parent.level === "subject" || parent.level === "course")) {
    return { context: null, managed: true };
  }
  const storedContexts = yield* Effect.promise(() =>
    ctx.db
      .query("curriculumRoutes")
      .withIndex(
        "by_snapshotId_and_locale_and_contextPath_and_order_and_path",
        (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("locale", locale)
            .eq("contextPath", parent.publicPath)
      )
      .take(PROGRAM_RELATED_LIMIT + 1)
  );
  if (storedContexts.length > PROGRAM_RELATED_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Curriculum context ${locale}/${parent.publicPath} exceeds ${PROGRAM_RELATED_LIMIT} rows.`
    );
  }
  const contexts = yield* Effect.forEach(storedContexts, (row) =>
    verifyCurriculum(row, snapshotId).pipe(
      Effect.map((context) => ({ context, row }))
    )
  );
  const matches = contexts.filter(({ context }) =>
    ownsMaterial(context, group, parent, input)
  );
  if (matches.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Curriculum context ${input.programKey}/${input.nodeKey} has ambiguous material ownership.`
    );
  }
  const match = matches[0];
  if (!match) {
    return { context: null, managed: true };
  }
  return {
    context: {
      groupJson: storedGroup.rowJson,
      mapping: match.context,
      mappingJson: match.row.rowJson,
      parentJson: storedParent.rowJson,
    },
    managed: true,
  };
});
