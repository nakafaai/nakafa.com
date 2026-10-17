import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/queries/trending.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contents/queries/trending.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getTrendingSubjects"]: RegisteredConvexFunction.register({ ...definitions["getTrendingSubjects"], handler: forward(definitions["getTrendingSubjects"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contents/queries/trending.spec")["default"]>;
