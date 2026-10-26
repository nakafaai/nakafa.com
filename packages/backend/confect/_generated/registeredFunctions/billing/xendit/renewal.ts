import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../billing/xendit/renewal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../billing/xendit/renewal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["read"]: RegisteredConvexFunction.register({ ...definitions["read"], handler: forward(definitions["read"].handler) }),
["record"]: RegisteredConvexFunction.register({ ...definitions["record"], handler: forward(definitions["record"].handler) }),
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../billing/xendit/renewal.spec")["default"]>;
