import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/runtime/signed.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/runtime/signed.spec")["default"]>(databaseSchema, groupLayer);

export default {
["stageTryoutRuntimeBundle"]: RegisteredConvexFunction.register({ ...definitions["stageTryoutRuntimeBundle"], handler: forward(definitions["stageTryoutRuntimeBundle"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/runtime/signed.spec")["default"]>;
