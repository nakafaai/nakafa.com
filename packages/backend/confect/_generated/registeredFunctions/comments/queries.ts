import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../comments/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../comments/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getCommentsBySlug"]: RegisteredConvexFunction.register({ ...definitions["getCommentsBySlug"], handler: forward(definitions["getCommentsBySlug"].handler) }),
["getCommentsByUserId"]: RegisteredConvexFunction.register({ ...definitions["getCommentsByUserId"], handler: forward(definitions["getCommentsByUserId"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../comments/queries.spec")["default"]>;
