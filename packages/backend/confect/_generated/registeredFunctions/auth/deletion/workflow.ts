import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../auth/deletion/workflow.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../auth/deletion/workflow.spec")["default"]>(databaseSchema, groupLayer);

export default {
["finalize"]: RegisteredConvexFunction.register({ ...definitions["finalize"], handler: forward(definitions["finalize"].handler) }),
["launch"]: RegisteredConvexFunction.register({ ...definitions["launch"], handler: forward(definitions["launch"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../auth/deletion/workflow.spec")["default"]>;
