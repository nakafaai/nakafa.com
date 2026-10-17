import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../triggers/comments/cleanup.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../triggers/comments/cleanup.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cleanupDeletedComment"]: RegisteredConvexFunction.register({ ...definitions["cleanupDeletedComment"], handler: forward(definitions["cleanupDeletedComment"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../triggers/comments/cleanup.spec")["default"]>;
