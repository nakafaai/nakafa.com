import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/provision.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/provision.spec")["default"]>(databaseSchema, groupLayer);

export default {
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/provision.spec")["default"]>;
