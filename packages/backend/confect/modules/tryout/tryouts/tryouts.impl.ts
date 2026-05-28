import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  completePart,
  startPart,
  startTryout,
} from "@repo/backend/confect/modules/tryout/tryoutAttempts.service";
import {
  getActiveTryoutCatalogPage,
  getActiveTryoutCatalogSnapshot,
  getPublicActiveTryoutCatalogSnapshot,
  getTryoutDetails,
} from "@repo/backend/confect/modules/tryout/tryoutCatalog.service";
import {
  expireTryoutAttemptInternal,
  promoteProvisionalTryoutScores,
  sweepExpiredTryoutAttempts,
} from "@repo/backend/confect/modules/tryout/tryoutInternal.service";
import {
  getGlobalLeaderboard,
  getTryoutLeaderboard,
  updateLeaderboard,
} from "@repo/backend/confect/modules/tryout/tryoutLeaderboard.service";
import {
  getUserTryoutAttempt,
  getUserTryoutAttemptHistory,
  getUserTryoutPartAttempt,
  getUserTryoutSession,
  getUserTryoutSetView,
} from "@repo/backend/confect/modules/tryout/tryoutMeQueries.service";
import { rebuildUserTryoutStats } from "@repo/backend/confect/modules/tryout/tryoutStats.service";
import { Effect, Layer } from "effect";

const tryouts_queries_me_history_getUserTryoutAttemptHistoryImpl =
  FunctionImpl.make(
    api,
    "tryouts.queries.me.history",
    "getUserTryoutAttemptHistory",
    (args) =>
      getUserTryoutAttemptHistory(args).pipe(
        Effect.catchTags({
          IrtError: (error) => Effect.die(error),
          TryoutError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );
const tryouts_mutations_attempts_completePartImpl = FunctionImpl.make(
  api,
  "tryouts.mutations.attempts",
  "completePart",
  (args) =>
    completePart(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const tryouts_mutations_attempts_startPartImpl = FunctionImpl.make(
  api,
  "tryouts.mutations.attempts",
  "startPart",
  (args) =>
    startPart(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const tryouts_mutations_attempts_startTryoutImpl = FunctionImpl.make(
  api,
  "tryouts.mutations.attempts",
  "startTryout",
  (args) =>
    startTryout(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const tryouts_queries_leaderboard_getTryoutLeaderboardImpl = FunctionImpl.make(
  api,
  "tryouts.queries.leaderboard",
  "getTryoutLeaderboard",
  (args) =>
    getTryoutLeaderboard(args).pipe(
      Effect.catchTag("TryoutError", (error) => Effect.die(error)),
      Effect.orDie
    )
);
const tryouts_queries_leaderboard_getGlobalLeaderboardImpl = FunctionImpl.make(
  api,
  "tryouts.queries.leaderboard",
  "getGlobalLeaderboard",
  (args) => getGlobalLeaderboard(args).pipe(Effect.orDie)
);
const tryouts_queries_tryouts_getActiveTryoutCatalogPageImpl =
  FunctionImpl.make(
    api,
    "tryouts.queries.tryouts",
    "getActiveTryoutCatalogPage",
    (args) => getActiveTryoutCatalogPage(args).pipe(Effect.orDie)
  );
const tryouts_queries_tryouts_getActiveTryoutCatalogSnapshotImpl =
  FunctionImpl.make(
    api,
    "tryouts.queries.tryouts",
    "getActiveTryoutCatalogSnapshot",
    (args) => getActiveTryoutCatalogSnapshot(args).pipe(Effect.orDie)
  );
const tryouts_queries_tryouts_getPublicActiveTryoutCatalogSnapshotImpl =
  FunctionImpl.make(
    api,
    "tryouts.queries.tryouts",
    "getPublicActiveTryoutCatalogSnapshot",
    (args) => getPublicActiveTryoutCatalogSnapshot(args).pipe(Effect.orDie)
  );
const tryouts_queries_tryouts_getTryoutDetailsImpl = FunctionImpl.make(
  api,
  "tryouts.queries.tryouts",
  "getTryoutDetails",
  (args) =>
    getTryoutDetails(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const tryouts_queries_me_attempt_getUserTryoutAttemptImpl = FunctionImpl.make(
  api,
  "tryouts.queries.me.attempt",
  "getUserTryoutAttempt",
  (args) =>
    getUserTryoutAttempt(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const tryouts_queries_me_part_getUserTryoutPartAttemptImpl = FunctionImpl.make(
  api,
  "tryouts.queries.me.part",
  "getUserTryoutPartAttempt",
  (args) =>
    getUserTryoutPartAttempt(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const tryouts_mutations_internal_expiry_expireTryoutAttemptInternalImpl =
  FunctionImpl.make(
    api,
    "tryouts.mutations.internalFunctions.expiry",
    "expireTryoutAttemptInternal",
    (args) =>
      expireTryoutAttemptInternal(args).pipe(
        Effect.catchTags({
          IrtError: (error) => Effect.die(error),
          TryoutError: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );
const tryouts_mutations_internal_expiry_sweepExpiredTryoutAttemptsImpl =
  FunctionImpl.make(
    api,
    "tryouts.mutations.internalFunctions.expiry",
    "sweepExpiredTryoutAttempts",
    (_args) =>
      sweepExpiredTryoutAttempts().pipe(
        Effect.catchTags({
          IrtError: (error) => Effect.die(error),
          TryoutError: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );
const tryouts_mutations_internal_leaderboard_updateLeaderboardImpl =
  FunctionImpl.make(
    api,
    "tryouts.mutations.internalFunctions.leaderboard",
    "updateLeaderboard",
    (args) =>
      updateLeaderboard(args).pipe(
        Effect.catchTag("TryoutError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );
const tryouts_mutations_internal_scoring_promoteProvisionalTryoutScoresImpl =
  FunctionImpl.make(
    api,
    "tryouts.mutations.internalFunctions.scoring",
    "promoteProvisionalTryoutScores",
    (args) =>
      promoteProvisionalTryoutScores(args).pipe(
        Effect.catchTag("TryoutError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );
const tryouts_mutations_internal_stats_rebuildUserTryoutStatsImpl =
  FunctionImpl.make(
    api,
    "tryouts.mutations.internalFunctions.stats",
    "rebuildUserTryoutStats",
    (args) => rebuildUserTryoutStats(args).pipe(Effect.orDie)
  );
const tryouts_queries_me_setView_getUserTryoutSetViewImpl = FunctionImpl.make(
  api,
  "tryouts.queries.me.setView",
  "getUserTryoutSetView",
  (args) =>
    getUserTryoutSetView(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const tryouts_queries_me_session_getUserTryoutSessionImpl = FunctionImpl.make(
  api,
  "tryouts.queries.me.session",
  "getUserTryoutSession",
  (args) =>
    getUserTryoutSession(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);
const tryoutsMutationsInternalExpiryImpl = GroupImpl.make(
  api,
  "tryouts.mutations.internalFunctions.expiry"
)
  .pipe(
    Layer.provide(
      tryouts_mutations_internal_expiry_expireTryoutAttemptInternalImpl
    )
  )
  .pipe(
    Layer.provide(
      tryouts_mutations_internal_expiry_sweepExpiredTryoutAttemptsImpl
    )
  );
const tryoutsMutationsInternalLeaderboardImpl = GroupImpl.make(
  api,
  "tryouts.mutations.internalFunctions.leaderboard"
).pipe(
  Layer.provide(tryouts_mutations_internal_leaderboard_updateLeaderboardImpl)
);
const tryoutsMutationsInternalScoringImpl = GroupImpl.make(
  api,
  "tryouts.mutations.internalFunctions.scoring"
).pipe(
  Layer.provide(
    tryouts_mutations_internal_scoring_promoteProvisionalTryoutScoresImpl
  )
);
const tryoutsMutationsInternalStatsImpl = GroupImpl.make(
  api,
  "tryouts.mutations.internalFunctions.stats"
).pipe(
  Layer.provide(tryouts_mutations_internal_stats_rebuildUserTryoutStatsImpl)
);
const tryoutsQueriesMeAttemptImpl = GroupImpl.make(
  api,
  "tryouts.queries.me.attempt"
).pipe(Layer.provide(tryouts_queries_me_attempt_getUserTryoutAttemptImpl));
const tryoutsQueriesMeHistoryImpl = GroupImpl.make(
  api,
  "tryouts.queries.me.history"
).pipe(
  Layer.provide(tryouts_queries_me_history_getUserTryoutAttemptHistoryImpl)
);
const tryoutsQueriesMePartImpl = GroupImpl.make(
  api,
  "tryouts.queries.me.part"
).pipe(Layer.provide(tryouts_queries_me_part_getUserTryoutPartAttemptImpl));
const tryoutsQueriesMeSessionImpl = GroupImpl.make(
  api,
  "tryouts.queries.me.session"
).pipe(Layer.provide(tryouts_queries_me_session_getUserTryoutSessionImpl));
const tryoutsQueriesMeSetViewImpl = GroupImpl.make(
  api,
  "tryouts.queries.me.setView"
).pipe(Layer.provide(tryouts_queries_me_setView_getUserTryoutSetViewImpl));
const tryoutsMutationsAttemptsImpl = GroupImpl.make(
  api,
  "tryouts.mutations.attempts"
)
  .pipe(Layer.provide(tryouts_mutations_attempts_completePartImpl))
  .pipe(Layer.provide(tryouts_mutations_attempts_startPartImpl))
  .pipe(Layer.provide(tryouts_mutations_attempts_startTryoutImpl));
const tryoutsMutationsInternalImpl = GroupImpl.make(
  api,
  "tryouts.mutations.internalFunctions"
)
  .pipe(Layer.provide(tryoutsMutationsInternalExpiryImpl))
  .pipe(Layer.provide(tryoutsMutationsInternalLeaderboardImpl))
  .pipe(Layer.provide(tryoutsMutationsInternalScoringImpl))
  .pipe(Layer.provide(tryoutsMutationsInternalStatsImpl));
const tryoutsQueriesLeaderboardImpl = GroupImpl.make(
  api,
  "tryouts.queries.leaderboard"
)
  .pipe(Layer.provide(tryouts_queries_leaderboard_getTryoutLeaderboardImpl))
  .pipe(Layer.provide(tryouts_queries_leaderboard_getGlobalLeaderboardImpl));
const tryoutsQueriesMeImpl = GroupImpl.make(api, "tryouts.queries.me")
  .pipe(Layer.provide(tryoutsQueriesMeAttemptImpl))
  .pipe(Layer.provide(tryoutsQueriesMeHistoryImpl))
  .pipe(Layer.provide(tryoutsQueriesMePartImpl))
  .pipe(Layer.provide(tryoutsQueriesMeSessionImpl))
  .pipe(Layer.provide(tryoutsQueriesMeSetViewImpl));
const tryoutsQueriesTryoutsImpl = GroupImpl.make(api, "tryouts.queries.tryouts")
  .pipe(Layer.provide(tryouts_queries_tryouts_getActiveTryoutCatalogPageImpl))
  .pipe(
    Layer.provide(tryouts_queries_tryouts_getActiveTryoutCatalogSnapshotImpl)
  )
  .pipe(
    Layer.provide(
      tryouts_queries_tryouts_getPublicActiveTryoutCatalogSnapshotImpl
    )
  )
  .pipe(Layer.provide(tryouts_queries_tryouts_getTryoutDetailsImpl));
const tryoutsMutationsImpl = GroupImpl.make(api, "tryouts.mutations")
  .pipe(Layer.provide(tryoutsMutationsAttemptsImpl))
  .pipe(Layer.provide(tryoutsMutationsInternalImpl));
const tryoutsQueriesImpl = GroupImpl.make(api, "tryouts.queries")
  .pipe(Layer.provide(tryoutsQueriesLeaderboardImpl))
  .pipe(Layer.provide(tryoutsQueriesMeImpl))
  .pipe(Layer.provide(tryoutsQueriesTryoutsImpl));
const tryoutsImpl = GroupImpl.make(api, "tryouts")
  .pipe(Layer.provide(tryoutsMutationsImpl))
  .pipe(Layer.provide(tryoutsQueriesImpl));
export const tryoutsLayer = Layer.mergeAll(tryoutsImpl);
