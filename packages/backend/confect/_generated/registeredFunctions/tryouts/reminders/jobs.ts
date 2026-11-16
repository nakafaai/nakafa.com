import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/reminders/jobs.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/reminders/jobs.spec")["default"]>(databaseSchema, groupLayer);

export default {
["hour"]: RegisteredConvexFunction.register({ ...definitions["hour"], handler: forward(definitions["hour"].handler) }),
["readEmail"]: RegisteredConvexFunction.register({ ...definitions["readEmail"], handler: forward(definitions["readEmail"].handler) }),
["enqueueEmail"]: RegisteredConvexFunction.register({ ...definitions["enqueueEmail"], handler: forward(definitions["enqueueEmail"].handler) }),
["email"]: RegisteredConvexFunction.register({ ...definitions["email"], handler: forward(definitions["email"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/reminders/jobs.spec")["default"]>;
