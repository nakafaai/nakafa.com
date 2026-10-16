import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/queries/content.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/queries/content.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getBatch"]: RegisteredConvexFunction.register({ ...definitions["getBatch"], handler: forward(definitions["getBatch"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/queries/content.spec")["default"]>;
