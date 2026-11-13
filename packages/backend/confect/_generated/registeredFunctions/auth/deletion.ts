import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/deletion.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../auth/deletion.spec")["default"]>(databaseSchema, groupLayer);

export default {
["deleteAccount"]: RegisteredConvexFunction.register({ ...definitions["deleteAccount"], handler: forward(definitions["deleteAccount"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../auth/deletion.spec")["default"]>;
