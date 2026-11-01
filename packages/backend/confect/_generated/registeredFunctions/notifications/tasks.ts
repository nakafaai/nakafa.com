import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../notifications/tasks.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../notifications/tasks.spec")["default"]>(databaseSchema, groupLayer);

export default {
["run"]: RegisteredConvexFunction.register({ ...definitions["run"], handler: forward(definitions["run"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../notifications/tasks.spec")["default"]>;
