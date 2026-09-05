import { readProgramModel } from "@repo/backend/content/program/model";
import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import {
  verifyCurriculum,
  verifyProgram,
} from "@repo/backend/content/program/verify";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect, Option } from "effect";

/** Reads one complete curriculum page model from immutable indexed sources. */
export const readProgramRoute = Effect.fn("contentRelease.readProgramRoute")(
  function* (
    appLocale: PublicationRow<"curriculumRoutes">["appLocale"],
    publicPath: string
  ) {
    const [globalActive, owner] = yield* Effect.all([
      loadActiveIdentity(),
      loadProgramOwner(appLocale),
    ]);
    if (!(owner.managed && owner.selected)) {
      return {
        activeManifestHash: globalActive?.manifestHash ?? null,
        activeReleaseId: globalActive?.releaseId ?? null,
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
    const source = yield* ProgramSource;
    const storedRoute = yield* source
      .route(snapshotId, appLocale, publicPath)
      .pipe(Effect.map(Option.getOrNull));
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
    const storedProgram = yield* source
      .program(snapshotId, route.programKey)
      .pipe(Effect.map(Option.getOrNull));
    if (!storedProgram) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Curriculum route ${appLocale}/${publicPath} lost program ${route.programKey}.`
      );
    }
    yield* verifyProgram(storedProgram, snapshotId);
    const model = yield* readProgramModel(
      snapshotId,
      route,
      active.signed.manifest.activeAppLocales,
      active.state.materialSlot
    );
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
