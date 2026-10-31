import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../integrations/writes.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../integrations/writes.spec")["default"]>(databaseSchema, groupLayer);

export default {
["importRoster"]: RegisteredConvexFunction.register({ ...definitions["importRoster"], handler: forward(definitions["importRoster"].handler) }),
["enterGrade"]: RegisteredConvexFunction.register({ ...definitions["enterGrade"], handler: forward(definitions["enterGrade"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../integrations/writes.spec")["default"]>;
