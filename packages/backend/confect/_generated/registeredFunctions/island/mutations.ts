import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../island/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../island/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
["change"]: RegisteredConvexFunction.register({ ...definitions["change"], handler: forward(definitions["change"].handler) }),
["unlock"]: RegisteredConvexFunction.register({ ...definitions["unlock"], handler: forward(definitions["unlock"].handler) }),
["share"]: RegisteredConvexFunction.register({ ...definitions["share"], handler: forward(definitions["share"].handler) }),
["greet"]: RegisteredConvexFunction.register({ ...definitions["greet"], handler: forward(definitions["greet"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../island/mutations.spec")["default"]>;
