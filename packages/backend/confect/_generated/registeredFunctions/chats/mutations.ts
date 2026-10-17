import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../chats/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../chats/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["updateChatTitle"]: RegisteredConvexFunction.register({ ...definitions["updateChatTitle"], handler: forward(definitions["updateChatTitle"].handler) }),
["updateChatVisibility"]: RegisteredConvexFunction.register({ ...definitions["updateChatVisibility"], handler: forward(definitions["updateChatVisibility"].handler) }),
["deleteChat"]: RegisteredConvexFunction.register({ ...definitions["deleteChat"], handler: forward(definitions["deleteChat"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../chats/mutations.spec")["default"]>;
