import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../integrations/tokens.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../integrations/tokens.spec")["default"]>(databaseSchema, groupLayer);

export default {
["issue"]: RegisteredConvexFunction.register({ ...definitions["issue"], handler: forward(definitions["issue"].handler) }),
["check"]: RegisteredConvexFunction.register({ ...definitions["check"], handler: forward(definitions["check"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../integrations/tokens.spec")["default"]>;
