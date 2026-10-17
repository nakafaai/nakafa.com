import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../analytics/capture.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../analytics/capture.spec")["default"]>(databaseSchema, groupLayer);

export default {
["isProductAnalyticsUserEligible"]: RegisteredConvexFunction.register({ ...definitions["isProductAnalyticsUserEligible"], handler: forward(definitions["isProductAnalyticsUserEligible"].handler) }),
["deliverProductEvent"]: RegisteredConvexFunction.register({ ...definitions["deliverProductEvent"], handler: forward(definitions["deliverProductEvent"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../analytics/capture.spec")["default"]>;
