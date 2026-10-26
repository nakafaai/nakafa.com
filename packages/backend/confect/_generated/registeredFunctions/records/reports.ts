import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../records/reports.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../records/reports.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cohorts"]: RegisteredConvexFunction.register({ ...definitions["cohorts"], handler: forward(definitions["cohorts"].handler) }),
["sheet"]: RegisteredConvexFunction.register({ ...definitions["sheet"], handler: forward(definitions["sheet"].handler) }),
["get"]: RegisteredConvexFunction.register({ ...definitions["get"], handler: forward(definitions["get"].handler) }),
["write"]: RegisteredConvexFunction.register({ ...definitions["write"], handler: forward(definitions["write"].handler) }),
["complete"]: RegisteredConvexFunction.register({ ...definitions["complete"], handler: forward(definitions["complete"].handler) }),
["reopen"]: RegisteredConvexFunction.register({ ...definitions["reopen"], handler: forward(definitions["reopen"].handler) }),
["approve"]: RegisteredConvexFunction.register({ ...definitions["approve"], handler: forward(definitions["approve"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../records/reports.spec")["default"]>;
