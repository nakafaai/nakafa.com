import type { DataModel as ConfectDataModel } from "@confect/server";
import type schemaDefinition from "@repo/backend/confect/schema";
import type {
  GenericActionCtx,
  GenericDatabaseWriter,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";

type SourceDataModel = ConfectDataModel.FromSchema<typeof schemaDefinition>;

/** Convex data model derived from the Confect schema source of truth. */
export type ConvexDataModel = ConfectDataModel.ToConvex<SourceDataModel>;

/** Raw Convex action context for documented component and adapter boundaries. */
export type ConvexActionCtx = GenericActionCtx<ConvexDataModel>;

/** Raw Convex database writer for explicit write-service boundaries. */
export type ConvexDatabaseWriter = GenericDatabaseWriter<ConvexDataModel>;

/** Raw Convex mutation context for shared helpers called from Confect services. */
export type ConvexMutationCtx = GenericMutationCtx<ConvexDataModel>;

/** Raw Convex query context for shared helpers called from Confect services. */
export type ConvexQueryCtx = GenericQueryCtx<ConvexDataModel>;
