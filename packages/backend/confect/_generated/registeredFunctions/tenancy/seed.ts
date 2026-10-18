import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/seed.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/seed.spec")["default"]>(databaseSchema, groupLayer);

export default {
["teacher"]: RegisteredConvexFunction.register({ ...definitions["teacher"], handler: forward(definitions["teacher"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/seed.spec")["default"]>;
