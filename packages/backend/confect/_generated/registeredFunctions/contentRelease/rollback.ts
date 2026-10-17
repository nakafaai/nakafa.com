import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/rollback.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/rollback.spec")["default"]>(databaseSchema, groupLayer);

export default {
["prepareRollback"]: RegisteredConvexFunction.register({ ...definitions["prepareRollback"], handler: forward(definitions["prepareRollback"].handler) }),
["prepareRoutes"]: RegisteredConvexFunction.register({ ...definitions["prepareRoutes"], handler: forward(definitions["prepareRoutes"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/rollback.spec")["default"]>;
