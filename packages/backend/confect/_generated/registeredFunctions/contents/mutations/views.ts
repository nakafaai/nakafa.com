import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/mutations/views.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contents/mutations/views.spec")["default"]>(databaseSchema, groupLayer);

export default {
["recordContentView"]: RegisteredConvexFunction.register({ ...definitions["recordContentView"], handler: forward(definitions["recordContentView"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contents/mutations/views.spec")["default"]>;
