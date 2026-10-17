import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/sections/hits.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contents/sections/hits.spec")["default"]>(databaseSchema, groupLayer);

export default {
["resolve"]: RegisteredConvexFunction.register({ ...definitions["resolve"], handler: forward(definitions["resolve"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contents/sections/hits.spec")["default"]>;
