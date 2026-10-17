import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/lifecycle.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../nina/lifecycle.spec")["default"]>(databaseSchema, groupLayer);

export default {
["presentation"]: RegisteredConvexFunction.register({ ...definitions["presentation"], handler: forward(definitions["presentation"].handler) }),
["claim"]: RegisteredConvexFunction.register({ ...definitions["claim"], handler: forward(definitions["claim"].handler) }),
["recover"]: RegisteredConvexFunction.register({ ...definitions["recover"], handler: forward(definitions["recover"].handler) }),
["expire"]: RegisteredConvexFunction.register({ ...definitions["expire"], handler: forward(definitions["expire"].handler) }),
["abandon"]: RegisteredConvexFunction.register({ ...definitions["abandon"], handler: forward(definitions["abandon"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
["cancel"]: RegisteredConvexFunction.register({ ...definitions["cancel"], handler: forward(definitions["cancel"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../nina/lifecycle.spec")["default"]>;
