import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../insight/narratives.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../insight/narratives.spec")["default"]>(databaseSchema, groupLayer);

export default {
["write"]: RegisteredConvexFunction.register({ ...definitions["write"], handler: forward(definitions["write"].handler) }),
["share"]: RegisteredConvexFunction.register({ ...definitions["share"], handler: forward(definitions["share"].handler) }),
["withdraw"]: RegisteredConvexFunction.register({ ...definitions["withdraw"], handler: forward(definitions["withdraw"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../insight/narratives.spec")["default"]>;
