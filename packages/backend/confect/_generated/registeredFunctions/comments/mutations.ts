import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../comments/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../comments/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["addComment"]: RegisteredConvexFunction.register({ ...definitions["addComment"], handler: forward(definitions["addComment"].handler) }),
["voteOnComment"]: RegisteredConvexFunction.register({ ...definitions["voteOnComment"], handler: forward(definitions["voteOnComment"].handler) }),
["deleteComment"]: RegisteredConvexFunction.register({ ...definitions["deleteComment"], handler: forward(definitions["deleteComment"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../comments/mutations.spec")["default"]>;
