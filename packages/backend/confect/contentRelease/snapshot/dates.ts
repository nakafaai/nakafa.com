import type { ContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot/data";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import { DateTime, Effect } from "effect";

/** The UTC day one active snapshot was first verified, none for a family the release leaves empty. */
const readSnapshotDate = Effect.fn("contentRelease.readSnapshotDate")(
  function* (
    family: ContentSnapshotManifest["family"],
    snapshotId: string | null
  ) {
    if (snapshotId === null) {
      return null;
    }
    const stored = yield* loadSnapshot(family, snapshotId);
    if (!stored || stored.verifiedAt === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active snapshot ${family}/${snapshotId} is not verified.`
      );
    }
    return DateTime.formatIsoDateUtc(DateTime.makeUnsafe(stored.verifiedAt));
  }
);

/**
 * The day each snapshot family of the active release last changed, which is the
 * only date its pages have: the Quran, the curricula and the try-outs author none.
 * A snapshot's id is the digest of its bytes and its first verification is never
 * overwritten, so a release that keeps a family keeps the date, and the date moves
 * when the family's bytes do. It covers the family, so one changed surah dates them all.
 */
export const readSnapshotDates = Effect.fn("contentRelease.readSnapshotDates")(
  function* () {
    const releaseId = (yield* loadState())?.activeReleaseId;
    if (releaseId === undefined) {
      return { assessment: null, program: null, quran: null };
    }
    const { snapshotTransitions } = yield* loadRelease(releaseId);
    return yield* Effect.all({
      assessment: readSnapshotDate(
        "assessment",
        snapshotTransitions.assessment.resultSnapshotId
      ),
      program: readSnapshotDate(
        "program",
        snapshotTransitions.program.resultSnapshotId
      ),
      quran: readSnapshotDate(
        "quran",
        snapshotTransitions.quran.resultSnapshotId
      ),
    });
  }
);
