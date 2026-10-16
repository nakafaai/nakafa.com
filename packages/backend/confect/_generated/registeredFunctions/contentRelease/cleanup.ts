import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/cleanup.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/cleanup.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cleanup"]: RegisteredConvexFunction.register({ ...definitions["cleanup"], handler: forward(definitions["cleanup"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/cleanup.spec")["default"]>;
