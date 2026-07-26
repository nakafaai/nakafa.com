import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadProgramRouteRow,
  readProgramModel,
} from "@repo/backend/convex/contentRelease/program/model";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import {
  verifyCurriculum,
  verifyProgram,
} from "@repo/backend/convex/contentRelease/program/verify";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Reads one complete curriculum page model from immutable indexed sources. */
export const readProgramRoute = Effect.fn("contentRelease.readProgramRoute")(
  function* (
    ctx: QueryCtx,
    locale: Doc<"curriculumRoutes">["locale"],
    publicPath: string
  ) {
    const owner = yield* loadProgramOwner(ctx, locale);
    if (!(owner.managed && owner.selected)) {
      return {
        activeManifestHash: owner.selected?.active.manifestHash ?? null,
        activeReleaseId: owner.selected?.active.releaseId ?? null,
        alternateJson: [],
        ancestorJson: [],
        childJson: [],
        contextJson: [],
        groupJson: [],
        managed: false,
        materialJson: [],
        programJson: null,
        routeJson: null,
        snapshotId: owner.selected?.snapshotId ?? null,
        sourceRevision: null,
      };
    }
    const { active, snapshotId } = owner.selected;
    const storedRoute = yield* loadProgramRouteRow(
      ctx,
      snapshotId,
      locale,
      publicPath
    );
    if (!storedRoute) {
      return {
        activeManifestHash: active.manifestHash,
        activeReleaseId: active.releaseId,
        alternateJson: [],
        ancestorJson: [],
        childJson: [],
        contextJson: [],
        groupJson: [],
        managed: true,
        materialJson: [],
        programJson: null,
        routeJson: null,
        snapshotId,
        sourceRevision: readSourceRevision(active),
      };
    }
    const route = yield* verifyCurriculum(storedRoute, snapshotId);
    const storedProgram = yield* Effect.promise(() =>
      ctx.db
        .query("programCatalog")
        .withIndex("by_snapshotId_and_programKey", (index) =>
          index.eq("snapshotId", snapshotId).eq("programKey", route.programKey)
        )
        .unique()
    );
    if (!storedProgram) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Curriculum route ${locale}/${publicPath} lost program ${route.programKey}.`
      );
    }
    yield* verifyProgram(storedProgram, snapshotId);
    const model = yield* readProgramModel(ctx, snapshotId, route);
    return {
      activeManifestHash: active.manifestHash,
      activeReleaseId: active.releaseId,
      alternateJson: model.alternates.map(({ rowJson }) => rowJson),
      ancestorJson: model.ancestors.map(({ rowJson }) => rowJson),
      childJson: model.children.map(({ rowJson }) => rowJson),
      contextJson: model.contexts.map(({ rowJson }) => rowJson),
      groupJson: model.groups.map(({ rowJson }) => rowJson),
      managed: true,
      materialJson: model.materialJson,
      programJson: storedProgram.rowJson,
      routeJson: storedRoute.rowJson,
      snapshotId,
      sourceRevision: readSourceRevision(active),
    };
  }
);
