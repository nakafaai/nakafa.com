import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/queries/history.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/queries/history.spec")["default"]>(databaseSchema, groupLayer);

export default {
["bySet"]: RegisteredConvexFunction.register({ ...definitions["bySet"], handler: forward(definitions["bySet"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/queries/history.spec")["default"]>;
