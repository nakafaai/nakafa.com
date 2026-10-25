import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type contentReleasesTable from "@repo/backend/confect/_generated/tables/contentReleases";
import { isSequence } from "@repo/backend/confect/contentRelease/compact/cycle";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { Array as Arr, Effect, Option, Predicate } from "effect";

type SlotIdentity = Pick<
  typeof contentReleasesTable.Doc.Type,
  "manifestHash" | "releaseId" | "sequence"
>;

/** Decodes one optional singleton slot without accepting partial identity. */
const slotIdentity = Effect.fn("contentRelease.compactionSlot")(function* (
  label: string,
  manifestHash: string | undefined,
  releaseId: string | undefined,
  sequence: number | undefined
) {
  if (
    manifestHash === undefined &&
    releaseId === undefined &&
    sequence === undefined
  ) {
    return null;
  }
  if (
    manifestHash === undefined ||
    releaseId === undefined ||
    sequence === undefined ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content ${label} slot has an incomplete compaction identity.`
    );
  }
  return {
    manifestHash,
    releaseId,
    sequence,
  } satisfies SlotIdentity;
});

/** Loads the exact release and direct base sequences that must remain reachable. */
const protectedRelease = Effect.fn("contentRelease.protectedRelease")(
  function* (release: Docs["contentReleases"], identity?: SlotIdentity) {
    const { sequence } = release;
    if (
      !isSequence(sequence) ||
      (identity !== undefined && sequence !== identity.sequence)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected identity.`
      );
    }
    if (
      identity !== undefined &&
      release.manifestHash !== identity.manifestHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected identity.`
      );
    }
    const baseId = release.baseReleaseId;
    const baseHash = release.baseManifestHash;
    if ((baseId === null) !== (baseHash === null)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected base.`
      );
    }
    // A bootstrap replaced the retired generation its base names, so that base
    // is never protected and never loaded.
    if (baseId === null || baseHash === null || release.bootstrap === true) {
      return [sequence];
    }
    const base = yield* loadRelease(baseId);
    if (!isSequence(base.sequence)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected base.`
      );
    }
    if (base.manifestHash !== baseHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${release.releaseId} lost its exact protected base.`
      );
    }
    return [sequence, base.sequence];
  }
);

/**
 * Protects all stored history from the floor upward when one reachability fact
 * is unprovable.
 */
const earliestStoredSequence = Effect.fn(
  "contentRelease.earliestStoredSequence"
)(function* (state: Docs["contentState"], historyFloor: number) {
  const database = yield* DatabaseReader;
  const earliest = yield* database
    .table("contentReleases")
    .index("by_sequence", (query) => query.gte("sequence", historyFloor))
    .first()
    .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  return earliest?.sequence ?? state.nextSequence;
});

/** Computes the earliest sequence protected by slots and known-good history. */
export const protectedFloor = Effect.fn("contentRelease.protectedFloor")(
  function* (state: Docs["contentState"], historyFloor: number) {
    const database = yield* DatabaseReader;
    const slots = yield* Effect.all([
      slotIdentity(
        "active",
        state.activeManifestHash,
        state.activeReleaseId,
        state.activeSequence
      ),
      slotIdentity(
        "candidate",
        state.candidateManifestHash,
        state.candidateReleaseId,
        state.candidateSequence
      ),
      slotIdentity(
        "recovery",
        state.recoveryManifestHash,
        state.recoveryReleaseId,
        state.recoverySequence
      ),
    ]);
    const slotSequences = yield* Effect.forEach(slots, (slot) => {
      if (slot === null) {
        return Effect.succeed<null | readonly number[]>([]);
      }
      return loadRelease(slot.releaseId).pipe(
        Effect.flatMap((release) => protectedRelease(release, slot)),
        // A missing slot release is an unprovable reachability fact: never
        // break compaction, protect the stored history instead.
        Effect.catchTag("ReleaseError", (error: ReleaseError) =>
          error.code === "CONTENT_RELEASE_MISSING"
            ? Effect.succeed(null)
            : Effect.fail(error)
        )
      );
    });
    const completed = yield* database
      .table("contentReleases")
      .index(
        "by_status_and_sequence",
        (query) => query.eq("status", "completed"),
        "desc"
      )
      .take(2)
      .pipe(Effect.orDie);
    const completedAboveFloor = Arr.filter(
      completed,
      (release) => release.sequence >= historyFloor
    );
    const completedSequences = yield* Effect.forEach(
      completedAboveFloor,
      (release) => protectedRelease(release)
    );
    const entries = Arr.appendAll(slotSequences, completedSequences);
    if (!Arr.every(entries, Predicate.isNotNull)) {
      return yield* earliestStoredSequence(state, historyFloor);
    }
    // A base below the floor is retired history, so it never lowers the floor.
    const sequences = Arr.filter(
      Arr.flatten(entries),
      (sequence) => sequence >= historyFloor
    );
    return sequences.length === 0 ? state.nextSequence : Math.min(...sequences);
  }
);
