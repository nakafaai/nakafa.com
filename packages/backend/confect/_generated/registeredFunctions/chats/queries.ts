import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../chats/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../chats/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getChat"]: RegisteredConvexFunction.register({ ...definitions["getChat"], handler: forward(definitions["getChat"].handler) }),
["getOwnChats"]: RegisteredConvexFunction.register({ ...definitions["getOwnChats"], handler: forward(definitions["getOwnChats"].handler) }),
["getChatTitle"]: RegisteredConvexFunction.register({ ...definitions["getChatTitle"], handler: forward(definitions["getChatTitle"].handler) }),
["getShareToken"]: RegisteredConvexFunction.register({ ...definitions["getShareToken"], handler: forward(definitions["getShareToken"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../chats/queries.spec")["default"]>;
