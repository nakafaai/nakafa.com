import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../records/graduations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../records/graduations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cohorts"]: RegisteredConvexFunction.register({ ...definitions["cohorts"], handler: forward(definitions["cohorts"].handler) }),
["get"]: RegisteredConvexFunction.register({ ...definitions["get"], handler: forward(definitions["get"].handler) }),
["sheet"]: RegisteredConvexFunction.register({ ...definitions["sheet"], handler: forward(definitions["sheet"].handler) }),
["readiness"]: RegisteredConvexFunction.register({ ...definitions["readiness"], handler: forward(definitions["readiness"].handler) }),
["decide"]: RegisteredConvexFunction.register({ ...definitions["decide"], handler: forward(definitions["decide"].handler) }),
["issue"]: RegisteredConvexFunction.register({ ...definitions["issue"], handler: forward(definitions["issue"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../records/graduations.spec")["default"]>;
