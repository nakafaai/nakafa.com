import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../classroom/forum/reads.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../classroom/forum/reads.spec")["default"]>(databaseSchema, groupLayer);

export default {
["get"]: RegisteredConvexFunction.register({ ...definitions["get"], handler: forward(definitions["get"].handler) }),
["mark"]: RegisteredConvexFunction.register({ ...definitions["mark"], handler: forward(definitions["mark"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../classroom/forum/reads.spec")["default"]>;
