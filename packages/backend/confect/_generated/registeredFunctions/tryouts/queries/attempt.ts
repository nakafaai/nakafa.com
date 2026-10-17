import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/queries/attempt.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/queries/attempt.spec")["default"]>(databaseSchema, groupLayer);

export default {
["isLockedByAttemptId"]: RegisteredConvexFunction.register({ ...definitions["isLockedByAttemptId"], handler: forward(definitions["isLockedByAttemptId"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/queries/attempt.spec")["default"]>;
