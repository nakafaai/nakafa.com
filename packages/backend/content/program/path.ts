import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import { verifyCurriculum } from "@repo/backend/content/program/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { Effect, Option } from "effect";

/** Resolves lightweight curriculum ownership for proxy and locale routing. */
export const readProgramPath = Effect.fn("contentRelease.readProgramPath")(
  function* (
    appLocale: PublicationRow<"curriculumRoutes">["appLocale"],
    publicPath: string
  ) {
    const owner = yield* loadProgramOwner(appLocale);
    if (!(owner.managed && owner.selected)) {
      return { managed: false, routeJson: null };
    }
    const source = yield* ProgramSource;
    const route = yield* source
      .route(owner.selected.snapshotId, appLocale, publicPath)
      .pipe(Effect.map(Option.getOrNull));
    if (!route) {
      return { managed: true, routeJson: null };
    }
    yield* verifyCurriculum(route, owner.selected.snapshotId);
    return { managed: true, routeJson: route.rowJson };
  }
);
