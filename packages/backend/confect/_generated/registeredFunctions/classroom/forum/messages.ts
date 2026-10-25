import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../classroom/forum/messages.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../classroom/forum/messages.spec")["default"]>(databaseSchema, groupLayer);

export default {
["page"]: RegisteredConvexFunction.register({ ...definitions["page"], handler: forward(definitions["page"].handler) }),
["send"]: RegisteredConvexFunction.register({ ...definitions["send"], handler: forward(definitions["send"].handler) }),
["edit"]: RegisteredConvexFunction.register({ ...definitions["edit"], handler: forward(definitions["edit"].handler) }),
["hide"]: RegisteredConvexFunction.register({ ...definitions["hide"], handler: forward(definitions["hide"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../classroom/forum/messages.spec")["default"]>;
