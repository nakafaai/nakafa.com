import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../exams/sittings/timers.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../exams/sittings/timers.spec")["default"]>(databaseSchema, groupLayer);

export default {
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
["closeDue"]: RegisteredConvexFunction.register({ ...definitions["closeDue"], handler: forward(definitions["closeDue"].handler) }),
["closeAttempt"]: RegisteredConvexFunction.register({ ...definitions["closeAttempt"], handler: forward(definitions["closeAttempt"].handler) }),
["submit"]: RegisteredConvexFunction.register({ ...definitions["submit"], handler: forward(definitions["submit"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../exams/sittings/timers.spec")["default"]>;
