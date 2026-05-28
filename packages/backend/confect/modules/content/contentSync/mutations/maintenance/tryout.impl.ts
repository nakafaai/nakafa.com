import { FunctionImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  deleteBatchFromTable,
  deleteTryoutEntitlementsBatch,
  deleteTryoutRuntimeBatch,
} from "@repo/backend/confect/modules/content/contentSyncMaintenance.service";
import { Effect } from "effect";

export const contentSync_mutations_maintenance_deleteTryoutAccessCampaignProductsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignProductsBatch",
    (_args) =>
      deleteBatchFromTable("tryoutAccessCampaignProducts").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutAccessCampaignsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignsBatch",
    (_args) => deleteBatchFromTable("tryoutAccessCampaigns").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutAccessGrantsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessGrantsBatch",
    (_args) => deleteBatchFromTable("tryoutAccessGrants").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutAccessLinksBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessLinksBatch",
    (_args) => deleteBatchFromTable("tryoutAccessLinks").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAttemptsBatch",
    (_args) => deleteBatchFromTable("tryoutAttempts").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutCatalogMetaBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutCatalogMetaBatch",
    (_args) => deleteBatchFromTable("tryoutCatalogMeta").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutEntitlementsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutEntitlementsBatch",
    (_args) => deleteTryoutEntitlementsBatch().pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutLeaderboardEntriesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutLeaderboardEntriesBatch",
    (_args) =>
      deleteBatchFromTable("tryoutLeaderboardEntries").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutPartAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartAttemptsBatch",
    (_args) => deleteBatchFromTable("tryoutPartAttempts").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutPartSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartSetsBatch",
    (_args) => deleteBatchFromTable("tryoutPartSets").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteTryoutRuntimeBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutRuntimeBatch",
    (_args) =>
      deleteTryoutRuntimeBatch().pipe(
        Effect.catchTag("ContentSyncMaintenanceError", (error) =>
          Effect.die(error)
        ),
        Effect.orDie
      )
  );
export const contentSync_mutations_maintenance_deleteTryoutsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutsBatch",
    (_args) => deleteBatchFromTable("tryouts").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteUserTryoutStatsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteUserTryoutStatsBatch",
    (_args) => deleteBatchFromTable("userTryoutStats").pipe(Effect.orDie)
  );
