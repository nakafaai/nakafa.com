import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readVisibleMaterial } from "@repo/backend/convex/contentRelease/material/route";
import { PROGRAM_RELATED_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { loadProgramRouteRow } from "@repo/backend/convex/contentRelease/program/model";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { verifyCurriculum } from "@repo/backend/convex/contentRelease/program/verify";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect } from "effect";

interface ProgramContextInput {
  readonly contentKey: string;
  readonly materialKey: string;
  readonly nodeKey: string;
  readonly parentPath: string;
  readonly programKey: string;
  readonly publicPath: string;
}

interface RenamedMaterialSource {
  readonly parentPath: string;
  readonly publicPath: string;
}

const SOURCE_ROUTE_LIMIT = 2;

/** Checks whether one curriculum mapping owns the stable material identity. */
function ownsMaterialIdentity(
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
    context.programKey === input.programKey
  );
}

/** Resolves the source route for one exact active material identity. */
const readRenamedMaterialSource = Effect.fn(
  "contentRelease.readRenamedMaterialSource"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"curriculumRoutes">["locale"],
  input: ProgramContextInput
) {
  const row = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_contentKey_and_locale", (index) =>
        index.eq("contentKey", input.contentKey).eq("locale", locale)
      )
      .unique()
  );
  if (!row) {
    return;
  }
  const selected = yield* readVisibleMaterial(ctx, row, false);
  if (
    !selected ||
    selected.projection.materialKey !== input.materialKey ||
    selected.projection.parentPath !== input.parentPath ||
    selected.projection.publicPath !== input.publicPath
  ) {
    return;
  }
  const routes = yield* Effect.promise(() =>
    ctx.db
      .query("publicRoutes")
      .withIndex("by_locale_and_sourcePath", (index) =>
        index.eq("locale", locale).eq("sourcePath", input.contentKey)
      )
      .take(SOURCE_ROUTE_LIMIT + 1)
  );
  if (routes.length > SOURCE_ROUTE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material source ${locale}/${input.contentKey} exceeds ${SOURCE_ROUTE_LIMIT} rows.`
    );
  }
  const identities = new Map<string, RenamedMaterialSource>();
  for (const route of routes) {
    if (
      route.kind !== "subject-lesson" ||
      route.materialKey !== input.materialKey ||
      !route.parentPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material source ${locale}/${input.contentKey} changed route identity.`
      );
    }
    const identity = {
      parentPath: route.parentPath,
      publicPath: route.publicPath,
    };
    identities.set(`${identity.parentPath}\0${identity.publicPath}`, identity);
  }
  if (identities.size > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material source ${locale}/${input.contentKey} has ambiguous route identity.`
    );
  }
  return identities.values().next().value;
});

/** Maps one source-owned canonical path to its current exact material path. */
function resolveRenamedCanonicalPath(
  canonicalPath: string | undefined,
  input: ProgramContextInput,
  source: RenamedMaterialSource
) {
  if (canonicalPath === source.publicPath) {
    return input.publicPath;
  }
  if (canonicalPath === source.parentPath) {
    return input.parentPath;
  }
  return;
}

/** Selects curriculum mappings that still own one renamed material source. */
function selectRenamedMappings(
  contexts: readonly {
    readonly context: Effect.Effect.Success<
      ReturnType<typeof verifyCurriculum>
    >;
    readonly row: Doc<"curriculumRoutes">;
  }[],
  input: ProgramContextInput,
  source: RenamedMaterialSource
) {
  return contexts.flatMap((match) => {
    const resolvedCanonicalPath = resolveRenamedCanonicalPath(
      match.context.canonicalPath,
      input,
      source
    );
    return resolvedCanonicalPath ? [{ match, resolvedCanonicalPath }] : [];
  });
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
  const identityMatches = contexts.filter(({ context }) =>
    ownsMaterialIdentity(context, group, parent, input)
  );
  const directMatches = identityMatches.filter(
    ({ context }) =>
      context.canonicalPath === input.publicPath ||
      context.canonicalPath === input.parentPath
  );
  let matches = directMatches;
  let resolvedCanonicalPath: string | undefined =
    directMatches.at(0)?.context.canonicalPath;
  if (directMatches.length === 0) {
    const source = yield* readRenamedMaterialSource(ctx, locale, input);
    const renamed = source
      ? selectRenamedMappings(identityMatches, input, source)
      : [];
    matches = renamed.map(({ match }) => match);
    resolvedCanonicalPath = renamed.at(0)?.resolvedCanonicalPath;
  }
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
      resolvedCanonicalPath,
    },
    managed: true,
  };
});
