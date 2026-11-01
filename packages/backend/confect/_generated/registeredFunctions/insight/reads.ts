import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../insight/reads.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../insight/reads.spec")["default"]>(databaseSchema, groupLayer);

export default {
["ofClass"]: RegisteredConvexFunction.register({ ...definitions["ofClass"], handler: forward(definitions["ofClass"].handler) }),
["mine"]: RegisteredConvexFunction.register({ ...definitions["mine"], handler: forward(definitions["mine"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../insight/reads.spec")["default"]>;
