import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../comments/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../comments/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["addComment"]: RegisteredConvexFunction.register({ ...definitions["addComment"], handler: forward(definitions["addComment"].handler) }),
["likeComment"]: RegisteredConvexFunction.register({ ...definitions["likeComment"], handler: forward(definitions["likeComment"].handler) }),
["unlikeComment"]: RegisteredConvexFunction.register({ ...definitions["unlikeComment"], handler: forward(definitions["unlikeComment"].handler) }),
["deleteComment"]: RegisteredConvexFunction.register({ ...definitions["deleteComment"], handler: forward(definitions["deleteComment"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../comments/mutations.spec")["default"]>;
