import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/mutations/analytics.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contents/mutations/analytics.spec")["default"]>(databaseSchema, groupLayer);

export default {
["scheduleContentAnalyticsPartitions"]: RegisteredConvexFunction.register({ ...definitions["scheduleContentAnalyticsPartitions"], handler: forward(definitions["scheduleContentAnalyticsPartitions"].handler) }),
["scheduleContentAnalyticsPartition"]: RegisteredConvexFunction.register({ ...definitions["scheduleContentAnalyticsPartition"], handler: forward(definitions["scheduleContentAnalyticsPartition"].handler) }),
["processContentAnalyticsPartition"]: RegisteredConvexFunction.register({ ...definitions["processContentAnalyticsPartition"], handler: forward(definitions["processContentAnalyticsPartition"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contents/mutations/analytics.spec")["default"]>;
