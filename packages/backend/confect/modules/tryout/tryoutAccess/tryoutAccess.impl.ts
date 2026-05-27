import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as tryout_access_maintenance from "@repo/backend/confect/modules/tryout/tryoutAccess/maintenance.service";
import * as tryout_access_page from "@repo/backend/confect/modules/tryout/tryoutAccess/page.service";
import * as tryout_access_redeem from "@repo/backend/confect/modules/tryout/tryoutAccess/redeem.service";
import * as tryout_access_status from "@repo/backend/confect/modules/tryout/tryoutAccess/status.service";
import * as tryout_access_setup from "@repo/backend/confect/modules/tryout/tryoutAccessSetup.service";
import { Effect, Layer } from "effect";

const tryoutAccess_mutations_internal_competition_finalizeCompetitionCampaignResultsImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.competition",
    "finalizeCompetitionCampaignResults",
    (args) => tryout_access_status.finalizeCompetitionCampaignResults(args)
  );

const tryoutAccess_queries_internal_maintenance_getTryoutAccessCampaignIntegrityImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "getTryoutAccessCampaignIntegrity",
    (args) => tryout_access_maintenance.getTryoutAccessCampaignIntegrity(args)
  );

const tryoutAccess_queries_internal_maintenance_getTryoutAccessGrantIntegrityImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "getTryoutAccessGrantIntegrity",
    (args) => tryout_access_maintenance.getTryoutAccessGrantIntegrity(args)
  );

const tryoutAccess_queries_internal_maintenance_getTryoutAccessEntitlementIntegrityImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "getTryoutAccessEntitlementIntegrity",
    (args) =>
      tryout_access_maintenance.getTryoutAccessEntitlementIntegrity(args)
  );

const tryoutAccess_queries_internal_maintenance_listCompetitionCampaignProductsByProductImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.queries.internalFunctions.maintenance",
    "listCompetitionCampaignProductsByProduct",
    (args) =>
      tryout_access_maintenance.listCompetitionCampaignProductsByProduct(args)
  );

const tryoutAccess_mutations_setup_upsertCampaignAndLinkImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.setup",
    "upsertCampaignAndLink",
    (args) =>
      tryout_access_setup
        .upsertCampaignAndLink(args)
        .pipe(
          Effect.catchTag("TryoutAccessError", (error) => Effect.die(error))
        )
  );

const tryoutAccess_mutations_internal_status_expireGrantImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.status",
    "expireGrant",
    (args) => tryout_access_status.expireGrant(args)
  );

const tryoutAccess_mutations_internal_status_sweepStatesImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.status",
    "sweepStates",
    (_args) => tryout_access_status.sweepStates()
  );

const tryoutAccess_mutations_internal_status_syncCampaignRedeemStatusImpl =
  FunctionImpl.make(
    api,
    "tryoutAccess.mutations.internalFunctions.status",
    "syncCampaignRedeemStatus",
    (args) => tryout_access_status.syncCampaignRedeemStatus(args)
  );

const tryoutAccess_mutations_redeem_redeemEventAccessImpl = FunctionImpl.make(
  api,
  "tryoutAccess.mutations.redeem",
  "redeemEventAccess",
  (args) =>
    tryout_access_redeem.redeemEventAccess(args).pipe(
      Effect.catchTags({
        TryoutAccessError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const tryoutAccess_queries_page_getEventPageStateImpl = FunctionImpl.make(
  api,
  "tryoutAccess.queries.page",
  "getEventPageState",
  (args) => tryout_access_page.getEventPageState(args)
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
