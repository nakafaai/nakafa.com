import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { isSelfSelectableUserRole } from "@repo/backend/convex/users/roles";
import {
  type PaginationOptions,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

/** Maximum user rows one lifecycle read may inspect. */
export const onboardingLifecyclePageLimit = 64;

/** Maximum user-table bytes one lifecycle read may inspect. */
export const onboardingLifecyclePageBytes = 4 * 1024 * 1024;

export const onboardingLifecycleCountsValidator = v.object({
  dataQuality: v.object({
    completedWithoutAdmission: v.number(),
    completedWithoutRole: v.number(),
    completedWithoutStart: v.number(),
    startedWithoutAdmission: v.number(),
  }),
  incomplete: v.object({
    admittedNotStarted: v.number(),
    noRecordedAdmission: v.number(),
    startedNotCompleted: v.number(),
  }),
  milestones: v.object({
    admitted: v.number(),
    completed: v.number(),
    started: v.number(),
  }),
  population: v.object({
    eligible: v.number(),
    excluded: v.number(),
    scanned: v.number(),
  }),
});

export type OnboardingLifecycleCounts = Infer<
  typeof onboardingLifecycleCountsValidator
>;

const onboardingLifecyclePageValidator = paginationResultValidator(
  onboardingLifecycleCountsValidator
);

type LifecycleUser = Pick<Doc<"users">, "deletedAt" | "role">;
type LifecycleProfile = Pick<
  Doc<"onboardingProfiles">,
  "admittedAt" | "completedAt" | "startedAt"
> | null;

type OnboardingLifecycleState =
  | { readonly kind: "excluded" }
  | { readonly kind: "no-recorded-admission" }
  | { readonly kind: "admitted-not-started" }
  | {
      readonly kind: "started-not-completed";
      readonly missingAdmission: boolean;
    }
  | {
      readonly kind: "completed";
      readonly missingAdmission: boolean;
      readonly missingRole: boolean;
      readonly missingStart: boolean;
    };

const invalidPageCode = "ONBOARDING_LIFECYCLE_INVALID_PAGE";
const readFailedCode = "ONBOARDING_LIFECYCLE_READ_FAILED";

/** Expected failure while reading bounded aggregate onboarding evidence. */
class OnboardingLifecycleReadError extends Schema.TaggedError<OnboardingLifecycleReadError>()(
  "OnboardingLifecycleReadError",
  {
    code: Schema.Literals([invalidPageCode, readFailedCode]),
    message: Schema.String,
  }
) {}

/** Defines lifecycle state from milestones without inferring completion from role. */
function classifyOnboardingLifecycle(
  user: LifecycleUser,
  profile: LifecycleProfile
): OnboardingLifecycleState {
  if (user.deletedAt !== undefined) {
    return { kind: "excluded" };
  }

  if (profile?.completedAt !== undefined) {
    return {
      kind: "completed",
      missingAdmission: profile.admittedAt === undefined,
      missingRole: user.role === undefined,
      missingStart: profile.startedAt === undefined,
    };
  }

  const mayEnterOnboarding =
    user.role === undefined || isSelfSelectableUserRole(user.role);
  if (!mayEnterOnboarding) {
    return { kind: "excluded" };
  }

  if (profile?.startedAt !== undefined) {
    return {
      kind: "started-not-completed",
      missingAdmission: profile.admittedAt === undefined,
    };
  }

  if (profile?.admittedAt !== undefined) {
    return { kind: "admitted-not-started" };
  }

  return { kind: "no-recorded-admission" };
}

/** Creates the additive identity for one aggregate lifecycle page. */
function emptyOnboardingLifecycleCounts(): OnboardingLifecycleCounts {
  return {
    dataQuality: {
      completedWithoutAdmission: 0,
      completedWithoutRole: 0,
      completedWithoutStart: 0,
      startedWithoutAdmission: 0,
    },
    incomplete: {
      admittedNotStarted: 0,
      noRecordedAdmission: 0,
      startedNotCompleted: 0,
    },
    milestones: {
      admitted: 0,
      completed: 0,
      started: 0,
    },
    population: {
      eligible: 0,
      excluded: 0,
      scanned: 0,
    },
  };
}

/** Adds one user's content-free lifecycle evidence to an aggregate page. */
function addOnboardingLifecycleEvidence(
  counts: OnboardingLifecycleCounts,
  state: OnboardingLifecycleState
) {
  counts.population.scanned += 1;

  if (state.kind === "excluded") {
    counts.population.excluded += 1;
    return;
  }

  counts.population.eligible += 1;

  if (state.kind === "no-recorded-admission") {
    counts.incomplete.noRecordedAdmission += 1;
    return;
  }

  if (state.kind === "admitted-not-started") {
    counts.incomplete.admittedNotStarted += 1;
    counts.milestones.admitted += 1;
    return;
  }

  if (state.kind === "started-not-completed") {
    counts.incomplete.startedNotCompleted += 1;
    counts.milestones.started += 1;
    if (state.missingAdmission) {
      counts.dataQuality.startedWithoutAdmission += 1;
    } else {
      counts.milestones.admitted += 1;
    }
    return;
  }

  counts.milestones.completed += 1;
  if (state.missingRole) {
    counts.dataQuality.completedWithoutRole += 1;
  }
  if (state.missingAdmission) {
    counts.dataQuality.completedWithoutAdmission += 1;
  } else {
    counts.milestones.admitted += 1;
  }
  if (state.missingStart) {
    counts.dataQuality.completedWithoutStart += 1;
  } else {
    counts.milestones.started += 1;
  }
}

/** Rejects pagination inputs that could create an unbounded fan-out read. */
const validateLifecyclePage = Effect.fn("onboarding.lifecycle.validatePage")(
  function* (options: PaginationOptions) {
    const { maximumBytesRead, maximumRowsRead, numItems } = options;
    if (
      !Number.isSafeInteger(numItems) ||
      numItems < 1 ||
      numItems > onboardingLifecyclePageLimit ||
      maximumRowsRead === undefined ||
      !Number.isSafeInteger(maximumRowsRead) ||
      maximumRowsRead < numItems ||
      maximumRowsRead > onboardingLifecyclePageLimit ||
      maximumBytesRead === undefined ||
      !Number.isSafeInteger(maximumBytesRead) ||
      maximumBytesRead < 1 ||
      maximumBytesRead > onboardingLifecyclePageBytes
    ) {
      return yield* new OnboardingLifecycleReadError({
        code: invalidPageCode,
        message: `Lifecycle pages require 1 to ${onboardingLifecyclePageLimit} rows and at most ${onboardingLifecyclePageBytes} read bytes.`,
      });
    }

    return options;
  }
);

/** Maps database failures into the stable lifecycle read boundary. */
function readLifecycle<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: () =>
      new OnboardingLifecycleReadError({
        code: readFailedCode,
        message: "Unable to read onboarding lifecycle evidence.",
      }),
    try: operation,
  });
}

/**
 * Returns one bounded, aggregate-only lifecycle page for server-side audits.
 *
 * This is temporary and internal because paginated aggregates can be
 * differenced into small cohorts. No identifier, answer, PII, or timestamp
 * crosses the boundary.
 */
export const readLifecyclePage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: onboardingLifecyclePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const paginationOpts = yield* validateLifecyclePage(
          args.paginationOpts
        );
        const users = yield* readLifecycle(() =>
          ctx.db.query("users").paginate(paginationOpts)
        );
        const counts = emptyOnboardingLifecycleCounts();

        for (const user of users.page) {
          const profile = yield* readLifecycle(() =>
            ctx.db
              .query("onboardingProfiles")
              .withIndex("by_userId", (query) => query.eq("userId", user._id))
              .unique()
          );
          addOnboardingLifecycleEvidence(
            counts,
            classifyOnboardingLifecycle(user, profile)
          );
        }

        return { ...users, page: [counts] };
      })
    ),
});
