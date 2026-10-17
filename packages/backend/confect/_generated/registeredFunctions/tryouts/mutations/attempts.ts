import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/mutations/attempts.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/mutations/attempts.spec")["default"]>(databaseSchema, groupLayer);

export default {
["startAttempt"]: RegisteredConvexFunction.register({ ...definitions["startAttempt"], handler: forward(definitions["startAttempt"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/mutations/attempts.spec")["default"]>;
