import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../classroom/forum/seed.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../classroom/forum/seed.spec")["default"]>(databaseSchema, groupLayer);

export default {
["history"]: RegisteredConvexFunction.register({ ...definitions["history"], handler: forward(definitions["history"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../classroom/forum/seed.spec")["default"]>;
