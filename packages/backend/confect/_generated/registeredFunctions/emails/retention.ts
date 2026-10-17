import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../emails/retention.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../emails/retention.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cleanupRetainedEmailData"]: RegisteredConvexFunction.register({ ...definitions["cleanupRetainedEmailData"], handler: forward(definitions["cleanupRetainedEmailData"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../emails/retention.spec")["default"]>;
