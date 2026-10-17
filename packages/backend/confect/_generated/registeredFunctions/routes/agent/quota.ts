import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../routes/agent/quota.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../routes/agent/quota.spec")["default"]>(databaseSchema, groupLayer);

export default {
["consume"]: RegisteredConvexFunction.register({ ...definitions["consume"], handler: forward(definitions["consume"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../routes/agent/quota.spec")["default"]>;
