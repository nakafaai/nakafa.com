import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/events.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/events.spec")["default"]>(databaseSchema, groupLayer);

export default {
["record"]: RegisteredConvexFunction.register({ ...definitions["record"], handler: forward(definitions["record"].handler) }),
["apply"]: RegisteredConvexFunction.register({ ...definitions["apply"], handler: forward(definitions["apply"].handler) }),
["process"]: RegisteredConvexFunction.register({ ...definitions["process"], handler: forward(definitions["process"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
["listUnprocessed"]: RegisteredConvexFunction.register({ ...definitions["listUnprocessed"], handler: forward(definitions["listUnprocessed"].handler) }),
["cleanup"]: RegisteredConvexFunction.register({ ...definitions["cleanup"], handler: forward(definitions["cleanup"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/events.spec")["default"]>;
