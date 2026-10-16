import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/cleanup.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../auth/cleanup.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cleanupDeletedUser"]: RegisteredConvexFunction.register({ ...definitions["cleanupDeletedUser"], handler: forward(definitions["cleanupDeletedUser"].handler) }),
["drainDeletedUserData"]: RegisteredConvexFunction.register({ ...definitions["drainDeletedUserData"], handler: forward(definitions["drainDeletedUserData"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../auth/cleanup.spec")["default"]>;
