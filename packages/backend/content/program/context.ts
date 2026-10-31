import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { PROGRAM_RELATED_LIMIT } from "@repo/backend/confect/contentRelease/program/limits";
import { requireExpectedActiveRelease } from "@repo/backend/confect/contentRelease/runtime/pin";
import { readAncestors } from "@repo/backend/content/program/model";
import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import { verifyCurriculum } from "@repo/backend/content/program/verify";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { Array as Arr, Effect, Option, Schema } from "effect";

const ProgramContextInputSchema = Schema.Struct({
  contentKey: Schema.String,
  materialKey: Schema.String,
  nodeKey: Schema.String,
  parentPath: Schema.String,
  programKey: Schema.String,
  publicPath: Schema.String,
});
type ProgramContextInput = typeof ProgramContextInputSchema.Type;
/** Checks whether one curriculum mapping owns the stable material identity. */
function ownsMaterialIdentity(
  context: Effect.Success<ReturnType<typeof verifyCurriculum>>,
  group: Effect.Success<ReturnType<typeof verifyCurriculum>>,
  parent: Effect.Success<ReturnType<typeof verifyCurriculum>>,
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
/** Resolves one valid curriculum return context for a material, in one program snapshot. */
const resolveProgramContext = Effect.fn("contentRelease.resolveProgramContext")(
  function* (
    snapshotId: string,
    appLocale: PublicationRow<"curriculumRoutes">["appLocale"],
    input: ProgramContextInput
  ) {
    const source = yield* ProgramSource;
    const storedGroup = yield* source
      .node(snapshotId, appLocale, input.programKey, input.nodeKey)
      .pipe(Effect.map(Option.getOrNull));
    if (!storedGroup) {
      return {
        context: null,
        managed: true,
      };
    }
    const group = yield* verifyCurriculum(storedGroup, snapshotId);
    if (!group.parentPath) {
      return {
        context: null,
        managed: true,
      };
    }
    const storedParent = yield* source
      .route(snapshotId, appLocale, group.parentPath)
      .pipe(Effect.map(Option.getOrNull));
    if (!storedParent) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Curriculum context ${input.programKey}/${input.nodeKey} lost parent ${group.parentPath}.`
      );
    }
    const parent = yield* verifyCurriculum(storedParent, snapshotId);
    if (!(parent.level === "subject" || parent.level === "course")) {
      return {
        context: null,
        managed: true,
      };
    }
    const storedContexts = yield* source.related(
      snapshotId,
      appLocale,
      "contexts",
      parent.publicPath,
      PROGRAM_RELATED_LIMIT + 1
    );
    if (storedContexts.length > PROGRAM_RELATED_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Curriculum context ${appLocale}/${parent.publicPath} exceeds ${PROGRAM_RELATED_LIMIT} rows.`
      );
    }
    const contexts = yield* Effect.forEach(storedContexts, (row) =>
      verifyCurriculum(row, snapshotId).pipe(
        Effect.map((context) => ({
          context,
          row,
        }))
      )
    );
    const identityMatches = Arr.filter(contexts, ({ context }) =>
      ownsMaterialIdentity(context, group, parent, input)
    );
    const directMatches = Arr.filter(
      identityMatches,
      ({ context }) =>
        context.canonicalPath === input.publicPath ||
        context.canonicalPath === input.parentPath
    );
    if (directMatches.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Curriculum context ${input.programKey}/${input.nodeKey} has ambiguous material ownership.`
      );
    }
    const match = directMatches[0];
    if (!match) {
      return {
        context: null,
        managed: true,
      };
    }
    return {
      context: {
        group,
        groupJson: storedGroup.rowJson,
        mapping: {
          ...match.context,
          materialContextParentPath: parent.publicPath,
          materialContextPublicPath: group.publicPath,
        },
        mappingJson: match.row.rowJson,
        parent,
        parentJson: storedParent.rowJson,
        resolvedCanonicalPath: match.context.canonicalPath,
      },
      managed: true,
    };
  }
);
/** Resolves one valid curriculum return context for a material identity. */
export const readProgramContext = Effect.fn(
  "contentRelease.readProgramContext"
)(function* (
  appLocale: PublicationRow<"curriculumRoutes">["appLocale"],
  input: ProgramContextInput,
  expectedActiveReleaseId?: string | null
) {
  const active = yield* loadActiveIdentity();
  yield* requireExpectedActiveRelease(
    active,
    expectedActiveReleaseId,
    "Curriculum context"
  );
  const owner = yield* loadProgramOwner(appLocale);
  if (!(owner.managed && owner.selected)) {
    return {
      context: null,
      managed: false,
    };
  }
  return yield* resolveProgramContext(
    owner.selected.snapshotId,
    appLocale,
    input
  );
});
/**
 * Resolves every curriculum place that shows one material, each with the path above
 * its card-list parent, for the lesson's static page: the build writes them there, so
 * a reader's `ctx` picks its path before the first paint, with nothing to ask. A
 * mapping that resolves to no context, such as one of another lesson of the material,
 * shows nothing.
 */
export const readProgramPlacements = Effect.fn(
  "contentRelease.readProgramPlacements"
)(function* (
  appLocale: PublicationRow<"curriculumRoutes">["appLocale"],
  input: Omit<ProgramContextInput, "nodeKey" | "programKey">,
  expectedActiveReleaseId?: string | null
) {
  yield* requireExpectedActiveRelease(
    yield* loadActiveIdentity(),
    expectedActiveReleaseId,
    "Curriculum places"
  );
  const owner = yield* loadProgramOwner(appLocale);
  if (!(owner.managed && owner.selected)) {
    return [];
  }
  const { snapshotId } = owner.selected;
  const stored = yield* (yield* ProgramSource).mappings(
    snapshotId,
    appLocale,
    input.materialKey,
    PROGRAM_RELATED_LIMIT + 1
  );
  if (stored.length > PROGRAM_RELATED_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material ${appLocale}/${input.materialKey} exceeds ${PROGRAM_RELATED_LIMIT} curriculum places.`
    );
  }
  const mappings = yield* Effect.forEach(stored, (row) =>
    verifyCurriculum(row, snapshotId)
  );
  const places = Arr.dedupe(
    Arr.flatMap(mappings, ({ materialContextNodeKey, programKey }) =>
      materialContextNodeKey === undefined
        ? []
        : [`${programKey}~${materialContextNodeKey}`]
    )
  );
  const resolved = yield* Effect.forEach(places, (place) =>
    Effect.gen(function* () {
      const [programKey = "", nodeKey = ""] = place.split("~");
      const { context } = yield* resolveProgramContext(snapshotId, appLocale, {
        ...input,
        nodeKey,
        programKey,
      });
      if (context === null) {
        return Option.none();
      }
      const ancestors = yield* readAncestors(snapshotId, context.parent);
      return Option.some({
        ancestorJson: Arr.map(ancestors, ({ rowJson }) => rowJson),
        groupJson: context.groupJson,
        mappingJson: context.mappingJson,
        parentJson: context.parentJson,
        resolvedCanonicalPath: context.resolvedCanonicalPath,
      });
    })
  );
  return Arr.getSomes(resolved);
});
