import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/models.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/models.spec")["default"]>(databaseSchema, groupLayer);

export default {
["restart"]: RegisteredConvexFunction.register({ ...definitions["restart"], handler: forward(definitions["restart"].handler) }),
["status"]: RegisteredConvexFunction.register({ ...definitions["status"], handler: forward(definitions["status"].handler) }),
["resume"]: RegisteredConvexFunction.register({ ...definitions["resume"], handler: forward(definitions["resume"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/models.spec")["default"]>;
