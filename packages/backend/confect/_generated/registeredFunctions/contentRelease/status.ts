import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/status.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/status.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getStatus"]: RegisteredConvexFunction.register({ ...definitions["getStatus"], handler: forward(definitions["getStatus"].handler) }),
["current"]: RegisteredConvexFunction.register({ ...definitions["current"], handler: forward(definitions["current"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/status.spec")["default"]>;
