import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../island/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../island/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["own"]: RegisteredConvexFunction.register({ ...definitions["own"], handler: forward(definitions["own"].handler) }),
["week"]: RegisteredConvexFunction.register({ ...definitions["week"], handler: forward(definitions["week"].handler) }),
["leaders"]: RegisteredConvexFunction.register({ ...definitions["leaders"], handler: forward(definitions["leaders"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../island/queries.spec")["default"]>;
