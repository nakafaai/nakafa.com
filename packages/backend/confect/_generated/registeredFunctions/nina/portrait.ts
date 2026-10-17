import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/portrait.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../nina/portrait.spec")["default"]>(databaseSchema, groupLayer);

export default {
["claim"]: RegisteredConvexFunction.register({ ...definitions["claim"], handler: forward(definitions["claim"].handler) }),
["save"]: RegisteredConvexFunction.register({ ...definitions["save"], handler: forward(definitions["save"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../nina/portrait.spec")["default"]>;
