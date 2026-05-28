import { FunctionImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { deleteBatchFromTable } from "@repo/backend/confect/modules/content/contentSyncMaintenance.service";
import { Effect } from "effect";

export const contentSync_mutations_maintenance_deleteIrtCalibrationAttemptsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationAttemptsBatch",
    (_args) => deleteBatchFromTable("irtCalibrationAttempts").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtCalibrationCacheStatsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationCacheStatsBatch",
    (_args) =>
      deleteBatchFromTable("irtCalibrationCacheStats").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtCalibrationQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationQueueBatch",
    (_args) => deleteBatchFromTable("irtCalibrationQueue").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtCalibrationRunsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtCalibrationRunsBatch",
    (_args) => deleteBatchFromTable("irtCalibrationRuns").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtScalePublicationQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScalePublicationQueueBatch",
    (_args) =>
      deleteBatchFromTable("irtScalePublicationQueue").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtScaleQualityChecksBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleQualityChecksBatch",
    (_args) => deleteBatchFromTable("irtScaleQualityChecks").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtScaleQualityRefreshQueueBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleQualityRefreshQueueBatch",
    (_args) =>
      deleteBatchFromTable("irtScaleQualityRefreshQueue").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtScaleVersionItemsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleVersionItemsBatch",
    (_args) => deleteBatchFromTable("irtScaleVersionItems").pipe(Effect.orDie)
  );
export const contentSync_mutations_maintenance_deleteIrtScaleVersionsBatchImpl =
  FunctionImpl.make(
    api,
    "contentSync.mutations.maintenance",
    "deleteIrtScaleVersionsBatch",
    (_args) => deleteBatchFromTable("irtScaleVersions").pipe(Effect.orDie)
  );
