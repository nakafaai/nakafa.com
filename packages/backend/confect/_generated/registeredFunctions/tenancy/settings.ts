import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/settings.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/settings.spec")["default"]>(databaseSchema, groupLayer);

export default {
["setLocale"]: RegisteredConvexFunction.register({ ...definitions["setLocale"], handler: forward(definitions["setLocale"].handler) }),
["setPolicy"]: RegisteredConvexFunction.register({ ...definitions["setPolicy"], handler: forward(definitions["setPolicy"].handler) }),
["setName"]: RegisteredConvexFunction.register({ ...definitions["setName"], handler: forward(definitions["setName"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/settings.spec")["default"]>;
