import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../comments/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../comments/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getComment"]: RegisteredConvexFunction.register({ ...definitions["getComment"], handler: forward(definitions["getComment"].handler) }),
["getCommentPlace"]: RegisteredConvexFunction.register({ ...definitions["getCommentPlace"], handler: forward(definitions["getCommentPlace"].handler) }),
["getCommentsBySlug"]: RegisteredConvexFunction.register({ ...definitions["getCommentsBySlug"], handler: forward(definitions["getCommentsBySlug"].handler) }),
["getCommentReplies"]: RegisteredConvexFunction.register({ ...definitions["getCommentReplies"], handler: forward(definitions["getCommentReplies"].handler) }),
["getCommentsByUserId"]: RegisteredConvexFunction.register({ ...definitions["getCommentsByUserId"], handler: forward(definitions["getCommentsByUserId"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../comments/queries.spec")["default"]>;
