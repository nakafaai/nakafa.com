import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/queries/runtime.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/queries/runtime.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getSetAttemptState"]: RegisteredConvexFunction.register({ ...definitions["getSetAttemptState"], handler: forward(definitions["getSetAttemptState"].handler) }),
["getSectionAttemptState"]: RegisteredConvexFunction.register({ ...definitions["getSectionAttemptState"], handler: forward(definitions["getSectionAttemptState"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/queries/runtime.spec")["default"]>;
