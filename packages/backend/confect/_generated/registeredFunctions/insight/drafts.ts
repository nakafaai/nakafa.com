import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../insight/drafts.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../insight/drafts.spec")["default"]>(databaseSchema, groupLayer);

export default {
["ask"]: RegisteredConvexFunction.register({ ...definitions["ask"], handler: forward(definitions["ask"].handler) }),
["source"]: RegisteredConvexFunction.register({ ...definitions["source"], handler: forward(definitions["source"].handler) }),
["finish"]: RegisteredConvexFunction.register({ ...definitions["finish"], handler: forward(definitions["finish"].handler) }),
["write"]: RegisteredConvexFunction.register({ ...definitions["write"], handler: forward(definitions["write"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../insight/drafts.spec")["default"]>;
