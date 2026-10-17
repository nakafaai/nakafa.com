import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../vault/keys.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../vault/keys.spec")["default"]>(databaseSchema, groupLayer);

export default {
["rewrap"]: RegisteredConvexFunction.register({ ...definitions["rewrap"], handler: forward(definitions["rewrap"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../vault/keys.spec")["default"]>;
