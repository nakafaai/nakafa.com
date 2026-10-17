import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../posts/cleanup.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../posts/cleanup.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cleanupDeletedPost"]: RegisteredConvexFunction.register({ ...definitions["cleanupDeletedPost"], handler: forward(definitions["cleanupDeletedPost"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../posts/cleanup.spec")["default"]>;
