import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../triggers/chats/cleanup.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../triggers/chats/cleanup.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cleanupDeletedChat"]: RegisteredConvexFunction.register({ ...definitions["cleanupDeletedChat"], handler: forward(definitions["cleanupDeletedChat"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../triggers/chats/cleanup.spec")["default"]>;
