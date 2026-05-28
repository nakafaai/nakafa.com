import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  getTryoutAccessCampaignIntegrity,
  getTryoutAccessEntitlementIntegrity,
  getTryoutAccessGrantIntegrity,
  listCompetitionCampaignProductsByProduct,
} from "@repo/backend/confect/modules/tryout/tryoutAccess/maintenance.service";
import { getEventPageState } from "@repo/backend/confect/modules/tryout/tryoutAccess/page.service";
import { redeemEventAccess } from "@repo/backend/confect/modules/tryout/tryoutAccess/redeem.service";
import {
  expireGrant,
  finalizeCompetitionCampaignResults,
  sweepStates,
  syncCampaignRedeemStatus,
} from "@repo/backend/confect/modules/tryout/tryoutAccess/status.service";
import { upsertCampaignAndLink } from "@repo/backend/confect/modules/tryout/tryoutAccessSetup.service";
import { Effect, Layer } from "effect";

const tryoutAccess_mutations_internal_competition_finalizeCompetitionCampaignResultsImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.competition",
    "finalizeCompetitionCampaignResults",
    (args) => finalizeCompetitionCampaignResults(args).pipe(Effect.orDie)
  );

const tryoutAccess_queries_internal_maintenance_getTryoutAccessCampaignIntegrityImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "getTryoutAccessCampaignIntegrity",
    (args) => getTryoutAccessCampaignIntegrity(args).pipe(Effect.orDie)
  );

const tryoutAccess_queries_internal_maintenance_getTryoutAccessGrantIntegrityImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "getTryoutAccessGrantIntegrity",
    (args) => getTryoutAccessGrantIntegrity(args).pipe(Effect.orDie)
  );

const tryoutAccess_queries_internal_maintenance_getTryoutAccessEntitlementIntegrityImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "getTryoutAccessEntitlementIntegrity",
    (args) => getTryoutAccessEntitlementIntegrity(args).pipe(Effect.orDie)
  );

const tryoutAccess_queries_internal_maintenance_listCompetitionCampaignProductsByProductImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "listCompetitionCampaignProductsByProduct",
    (args) => listCompetitionCampaignProductsByProduct(args).pipe(Effect.orDie)
  );

const tryoutAccess_mutations_setup_upsertCampaignAndLinkImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.setup",
    "upsertCampaignAndLink",
    (args) =>
      upsertCampaignAndLink(args).pipe(
        Effect.catchTag("TryoutAccessError", (error) => Effect.die(error)),
        Effect.orDie
      )
  );

const tryoutAccess_mutations_internal_status_expireGrantImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.status",
    "expireGrant",
    (args) => expireGrant(args).pipe(Effect.orDie)
  );

const tryoutAccess_mutations_internal_status_sweepStatesImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.status",
    "sweepStates",
    (_args) => sweepStates().pipe(Effect.orDie)
  );

const tryoutAccess_mutations_internal_status_syncCampaignRedeemStatusImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.status",
    "syncCampaignRedeemStatus",
    (args) => syncCampaignRedeemStatus(args).pipe(Effect.orDie)
  );

const tryoutAccess_mutations_redeem_redeemEventAccessImpl = FunctionImpl.make(
  api,
  "tryoutAccess.mutations.redeem",
  "redeemEventAccess",
  (args) =>
    redeemEventAccess(args).pipe(
      Effect.catchTags({
        TryoutAccessError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const tryoutAccess_queries_page_getEventPageStateImpl = FunctionImpl.make(
  api,
  "tryoutAccess.queries.page",
  "getEventPageState",
  (args) => getEventPageState(args).pipe(Effect.orDie)
);

const tryoutAccessMutationsInternalCompetitionImpl = GroupImpl.make(
  api,
  "tryoutAccess.mutations.internalFunctions.competition"
).pipe(
  Layer.provide(
    tryoutAccess_mutations_internal_competition_finalizeCompetitionCampaignResultsImpl
  )
);

const tryoutAccessMutationsInternalStatusImpl = GroupImpl.make(
  api,
  "tryoutAccess.mutations.internalFunctions.status"
)
  .pipe(Layer.provide(tryoutAccess_mutations_internal_status_expireGrantImpl))
  .pipe(Layer.provide(tryoutAccess_mutations_internal_status_sweepStatesImpl))
  .pipe(
    Layer.provide(
      tryoutAccess_mutations_internal_status_syncCampaignRedeemStatusImpl
    )
  );

const tryoutAccessQueriesInternalMaintenanceImpl = GroupImpl.make(
  api,
  "tryoutAccess.queries.internalFunctions.maintenance"
)
  .pipe(
    Layer.provide(
      tryoutAccess_queries_internal_maintenance_getTryoutAccessCampaignIntegrityImpl
    )
  )
  .pipe(
    Layer.provide(
      tryoutAccess_queries_internal_maintenance_getTryoutAccessGrantIntegrityImpl
    )
  )
  .pipe(
    Layer.provide(
      tryoutAccess_queries_internal_maintenance_getTryoutAccessEntitlementIntegrityImpl
    )
  )
  .pipe(
    Layer.provide(
      tryoutAccess_queries_internal_maintenance_listCompetitionCampaignProductsByProductImpl
    )
  );

const tryoutAccessMutationsInternalImpl = GroupImpl.make(
  api,
  "tryoutAccess.mutations.internalFunctions"
)
  .pipe(Layer.provide(tryoutAccessMutationsInternalCompetitionImpl))
  .pipe(Layer.provide(tryoutAccessMutationsInternalStatusImpl));

const tryoutAccessMutationsRedeemImpl = GroupImpl.make(
  api,
  "tryoutAccess.mutations.redeem"
).pipe(Layer.provide(tryoutAccess_mutations_redeem_redeemEventAccessImpl));

const tryoutAccessMutationsSetupImpl = GroupImpl.make(
  api,
  "tryoutAccess.mutations.setup"
).pipe(Layer.provide(tryoutAccess_mutations_setup_upsertCampaignAndLinkImpl));

const tryoutAccessQueriesInternalImpl = GroupImpl.make(
  api,
  "tryoutAccess.queries.internalFunctions"
).pipe(Layer.provide(tryoutAccessQueriesInternalMaintenanceImpl));

const tryoutAccessQueriesPageImpl = GroupImpl.make(
  api,
  "tryoutAccess.queries.page"
).pipe(Layer.provide(tryoutAccess_queries_page_getEventPageStateImpl));

const tryoutAccessMutationsImpl = GroupImpl.make(api, "tryoutAccess.mutations")
  .pipe(Layer.provide(tryoutAccessMutationsInternalImpl))
  .pipe(Layer.provide(tryoutAccessMutationsRedeemImpl))
  .pipe(Layer.provide(tryoutAccessMutationsSetupImpl));

const tryoutAccessQueriesImpl = GroupImpl.make(api, "tryoutAccess.queries")
  .pipe(Layer.provide(tryoutAccessQueriesInternalImpl))
  .pipe(Layer.provide(tryoutAccessQueriesPageImpl));

const tryoutAccessImpl = GroupImpl.make(api, "tryoutAccess")
  .pipe(Layer.provide(tryoutAccessMutationsImpl))
  .pipe(Layer.provide(tryoutAccessQueriesImpl));

export const tryoutAccessLayer = Layer.mergeAll(tryoutAccessImpl);
