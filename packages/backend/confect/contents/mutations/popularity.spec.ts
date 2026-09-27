import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  ContentAnalyticsIoError,
  expireLearningPopularityWindowPageArgs,
  expireLearningPopularityWindowPageResultValidator,
  pruneLearningPopularityResultValidator,
  refreshLearningPopularityWindowPageArgs,
  refreshLearningPopularityWindowPageResultValidator,
  scheduleLearningPopularityExpiriesResultValidator,
  scheduleLearningPopularityRefreshesResultValidator,
} from "@repo/backend/confect/contents/analytics/spec";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "pruneLearningPopularity",
      args: () => ({}),
      returns: () => pruneLearningPopularityResultValidator,
      error: () => ContentAnalyticsIoError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "scheduleLearningPopularityExpiries",
      args: () => ({}),
      returns: () => scheduleLearningPopularityExpiriesResultValidator,
      error: () => ContentAnalyticsIoError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "scheduleLearningPopularityRefreshes",
      args: () => ({}),
      returns: () => scheduleLearningPopularityRefreshesResultValidator,
      error: () => ContentAnalyticsIoError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "refreshLearningPopularityWindowPage",
      args: () => refreshLearningPopularityWindowPageArgs,
      returns: () => refreshLearningPopularityWindowPageResultValidator,
      error: () => ContentAnalyticsIoError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expireLearningPopularityWindowPage",
      args: () => expireLearningPopularityWindowPageArgs,
      returns: () => expireLearningPopularityWindowPageResultValidator,
      error: () => ContentAnalyticsIoError,
    })
  );
