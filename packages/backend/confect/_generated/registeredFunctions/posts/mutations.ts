import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../posts/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../posts/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["create"]: RegisteredConvexFunction.register({ ...definitions["create"], handler: forward(definitions["create"].handler) }),
["remove"]: RegisteredConvexFunction.register({ ...definitions["remove"], handler: forward(definitions["remove"].handler) }),
["like"]: RegisteredConvexFunction.register({ ...definitions["like"], handler: forward(definitions["like"].handler) }),
["unlike"]: RegisteredConvexFunction.register({ ...definitions["unlike"], handler: forward(definitions["unlike"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../posts/mutations.spec")["default"]>;
