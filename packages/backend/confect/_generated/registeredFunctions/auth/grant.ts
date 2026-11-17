import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/grant.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../auth/grant.spec")["default"]>(databaseSchema, groupLayer);

export default {
["register"]: RegisteredConvexFunction.register({ ...definitions["register"], handler: forward(definitions["register"].handler) }),
["describe"]: RegisteredConvexFunction.register({ ...definitions["describe"], handler: forward(definitions["describe"].handler) }),
["authorize"]: RegisteredConvexFunction.register({ ...definitions["authorize"], handler: forward(definitions["authorize"].handler) }),
["exchange"]: RegisteredConvexFunction.register({ ...definitions["exchange"], handler: forward(definitions["exchange"].handler) }),
["refresh"]: RegisteredConvexFunction.register({ ...definitions["refresh"], handler: forward(definitions["refresh"].handler) }),
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["revoke"]: RegisteredConvexFunction.register({ ...definitions["revoke"], handler: forward(definitions["revoke"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../auth/grant.spec")["default"]>;
