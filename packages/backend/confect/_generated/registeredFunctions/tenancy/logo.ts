import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/logo.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/logo.spec")["default"]>(databaseSchema, groupLayer);

export default {
["reserve"]: RegisteredConvexFunction.register({ ...definitions["reserve"], handler: forward(definitions["reserve"].handler) }),
["set"]: RegisteredConvexFunction.register({ ...definitions["set"], handler: forward(definitions["set"].handler) }),
["remove"]: RegisteredConvexFunction.register({ ...definitions["remove"], handler: forward(definitions["remove"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/logo.spec")["default"]>;
