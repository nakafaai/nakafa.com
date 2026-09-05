import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import { verifyCurriculum } from "@repo/backend/content/program/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  hasStaleReleaseCursor,
  validateReleaseCursor,
} from "@repo/backend/convex/contentRelease/cursor";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { validateProjectionPage } from "@repo/backend/convex/contentRelease/paging";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Returns a stable empty page before Aksara owns programs and materials. */
function emptyPage() {
  return {
    continueCursor: "",
    isDone: true,
    page: [],
  };
}

/** Reads one release-bound page of immutable localized curriculum routes. */
export const readProgramPage = Effect.fn("contentRelease.readProgramPage")(
  function* (
    appLocale: PublicationRow<"curriculumRoutes">["appLocale"],
    expectedManifestHash: null | string,
    expectedReleaseId: null | string,
    paginationOpts: Parameters<typeof validateProjectionPage>[0]
  ) {
    const [options, owner] = yield* Effect.all([
      validateProjectionPage(paginationOpts),
      loadProgramOwner(appLocale),
    ]);
    if (options.endCursor !== undefined && options.endCursor !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        "Program pages accept only their server-owned continuation cursor."
      );
    }
    const active =
      owner.managed && owner.selected ? owner.selected.active : null;
    if (
      hasStaleReleaseCursor(
        options.cursor,
        expectedManifestHash,
        expectedReleaseId,
        active
      )
    ) {
      return {
        activeManifestHash: active?.manifestHash ?? null,
        activeReleaseId: active?.releaseId ?? null,
        managed: owner.managed,
        result: emptyPage(),
        snapshotId: owner.selected?.snapshotId ?? null,
        sourceRevision: active ? readSourceRevision(active) : null,
        stale: true,
      };
    }
    yield* validateReleaseCursor(
      options.cursor,
      expectedManifestHash,
      expectedReleaseId,
      active
    );
    if (!(owner.managed && owner.selected)) {
      return {
        activeManifestHash: owner.selected?.active.manifestHash ?? null,
        activeReleaseId: owner.selected?.active.releaseId ?? null,
        managed: false,
        result: emptyPage(),
        snapshotId: owner.selected?.snapshotId ?? null,
        sourceRevision: null,
        stale: false,
      };
    }
    const source = yield* ProgramSource;
    const stored = yield* source.page(
      owner.selected.snapshotId,
      appLocale,
      options
    );
    yield* Effect.forEach(stored.page, (row) =>
      verifyCurriculum(row, owner.selected.snapshotId)
    );
    return {
      activeManifestHash: owner.selected.active.manifestHash,
      activeReleaseId: owner.selected.active.releaseId,
      managed: true,
      result: { ...stored, page: stored.page.map(({ rowJson }) => rowJson) },
      snapshotId: owner.selected.snapshotId,
      sourceRevision: readSourceRevision(owner.selected.active),
      stale: false,
    };
  }
);
