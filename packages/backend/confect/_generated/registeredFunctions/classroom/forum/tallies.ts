import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../classroom/forum/tallies.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../classroom/forum/tallies.spec")["default"]>(databaseSchema, groupLayer);

export default {
["since"]: RegisteredConvexFunction.register({ ...definitions["since"], handler: forward(definitions["since"].handler) }),
["react"]: RegisteredConvexFunction.register({ ...definitions["react"], handler: forward(definitions["react"].handler) }),
["vote"]: RegisteredConvexFunction.register({ ...definitions["vote"], handler: forward(definitions["vote"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../classroom/forum/tallies.spec")["default"]>;
