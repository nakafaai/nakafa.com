import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  ContentAnalyticsIoErrorWire,
  InvalidContentAnalyticsPartitionErrorWire,
  processContentAnalyticsPartitionArgs,
  processContentAnalyticsPartitionResultValidator,
  scheduleContentAnalyticsPartitionArgs,
  scheduleContentAnalyticsPartitionResultValidator,
  scheduleContentAnalyticsPartitionsResultValidator,
} from "@repo/backend/confect/contents/analytics/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "scheduleContentAnalyticsPartitions",
      args: () => ({}),
      returns: () => scheduleContentAnalyticsPartitionsResultValidator,
      error: () => ContentAnalyticsIoErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "scheduleContentAnalyticsPartition",
      args: () => scheduleContentAnalyticsPartitionArgs,
      returns: () => scheduleContentAnalyticsPartitionResultValidator,
      error: () =>
        Schema.Union([
          InvalidContentAnalyticsPartitionErrorWire,
          ContentAnalyticsIoErrorWire,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "processContentAnalyticsPartition",
      args: () => processContentAnalyticsPartitionArgs,
      returns: () => processContentAnalyticsPartitionResultValidator,
      error: () =>
        Schema.Union([
          InvalidContentAnalyticsPartitionErrorWire,
          ContentAnalyticsIoErrorWire,
        ]),
    })
  );
