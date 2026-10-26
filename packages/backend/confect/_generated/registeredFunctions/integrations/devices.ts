import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../integrations/devices.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../integrations/devices.spec")["default"]>(databaseSchema, groupLayer);

export default {
["start"]: RegisteredConvexFunction.register({ ...definitions["start"], handler: forward(definitions["start"].handler) }),
["poll"]: RegisteredConvexFunction.register({ ...definitions["poll"], handler: forward(definitions["poll"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
["authorize"]: RegisteredConvexFunction.register({ ...definitions["authorize"], handler: forward(definitions["authorize"].handler) }),
["deny"]: RegisteredConvexFunction.register({ ...definitions["deny"], handler: forward(definitions["deny"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../integrations/devices.spec")["default"]>;
