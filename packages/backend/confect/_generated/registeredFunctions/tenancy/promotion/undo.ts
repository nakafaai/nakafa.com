import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tenancy/promotion/undo.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tenancy/promotion/undo.spec")["default"]>(databaseSchema, groupLayer);

export default {
["undo"]: RegisteredConvexFunction.register({ ...definitions["undo"], handler: forward(definitions["undo"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tenancy/promotion/undo.spec")["default"]>;
