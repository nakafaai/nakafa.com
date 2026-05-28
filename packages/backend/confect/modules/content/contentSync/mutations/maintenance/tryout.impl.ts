import { FunctionImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  deleteBatchFromTable as contentSyncMaintenance_deleteBatchFromTable,
  deleteTryoutEntitlementsBatch as contentSyncMaintenance_deleteTryoutEntitlementsBatch,
  deleteTryoutRuntimeBatch as contentSyncMaintenance_deleteTryoutRuntimeBatch,
} from "@repo/backend/confect/modules/content/contentSyncMaintenance.service";
import { Effect } from "effect";

export const contentSync_mutations_maintenance_deleteTryoutAccessCampaignProductsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignProductsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable(
        "tryoutAccessCampaignProducts"
      ).pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteTryoutAccessCampaignsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessCampaignsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutAccessCampaigns").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteTryoutAccessGrantsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessGrantsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutAccessGrants").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteTryoutAccessLinksBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAccessLinksBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutAccessLinks").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteTryoutAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutAttemptsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutAttempts").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteTryoutCatalogMetaBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutCatalogMetaBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutCatalogMeta").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteTryoutEntitlementsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutEntitlementsBatch",
    (_args) =>
      contentSyncMaintenance_deleteTryoutEntitlementsBatch().pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteTryoutLeaderboardEntriesBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutLeaderboardEntriesBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable(
        "tryoutLeaderboardEntries"
      ).pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteTryoutPartAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartAttemptsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutPartAttempts").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteTryoutPartSetsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutPartSetsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryoutPartSets").pipe(
        Effect.orDie
      )
  );

export const contentSync_mutations_maintenance_deleteTryoutRuntimeBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteTryoutRuntimeBatch",
    (_args) =>
      contentSyncMaintenance_deleteTryoutRuntimeBatch().pipe(
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
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("tryouts").pipe(Effect.orDie)
  );

export const contentSync_mutations_maintenance_deleteUserTryoutStatsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteUserTryoutStatsBatch",
    (_args) =>
      contentSyncMaintenance_deleteBatchFromTable("userTryoutStats").pipe(
        Effect.orDie
      )
  );
