import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutResponseIntegrityError } from "@repo/backend/confect/tryouts/response/spec";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

type TryoutFlag = Docs["tryoutFlags"];
type TryoutPlacement = Docs["tryoutAttemptPlacements"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];

/** Loads the flagged placements of one section from its verified inventory. */
export const loadSectionFlags = Effect.fn("tryouts.flag.loadSection")(
  function* (
    section: TryoutSectionAttempt,
    placements: readonly TryoutPlacement[]
  ) {
    const database = yield* DatabaseReader;
    const flags = yield* database
      .table("tryoutFlags")
      .index("by_tryoutSectionAttemptId", (index) =>
        index.eq("tryoutSectionAttemptId", section._id)
      )
      .take(section.totalQuestions + 1)
      .pipe(Effect.mapError(toTryoutRuntimeError));
    if (flags.length > section.totalQuestions) {
      return yield* new TryoutResponseIntegrityError({
        code: "TRYOUT_FLAG_COUNT_EXCEEDED",
        message: "Try-out flag count exceeds the section question count.",
      });
    }
    return yield* indexTryoutFlags({
      flags,
      placementIds: new Set(placements.map((placement) => placement._id)),
      section,
    });
  }
);

/** Proves each flag row belongs to one verified placement of its section. */
export const indexTryoutFlags = Effect.fn("tryouts.flag.index")(
  function* (input: {
    readonly flags: readonly TryoutFlag[];
    readonly placementIds: ReadonlySet<Id<"tryoutAttemptPlacements">>;
    readonly section: TryoutSectionAttempt;
  }) {
    const flagged = new Set<Id<"tryoutAttemptPlacements">>();
    for (const flag of input.flags) {
      if (
        !input.placementIds.has(flag.placementId) ||
        flag.tryoutAttemptId !== input.section.tryoutAttemptId ||
        flag.tryoutSectionAttemptId !== input.section._id
      ) {
        return yield* new TryoutResponseIntegrityError({
          code: "TRYOUT_FLAG_LINK_MISMATCH",
          message: "Try-out flag links do not match its frozen placement.",
        });
      }
      if (flagged.has(flag.placementId)) {
        return yield* new TryoutResponseIntegrityError({
          code: "TRYOUT_FLAG_PLACEMENT_DUPLICATE",
          message: "Try-out placement has more than one flag.",
        });
      }
      flagged.add(flag.placementId);
    }
    return flagged;
  }
);
