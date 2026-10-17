import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/activate.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/activate.spec")["default"]>(databaseSchema, groupLayer);

export default {
["prepare"]: RegisteredConvexFunction.register({ ...definitions["prepare"], handler: forward(definitions["prepare"].handler) }),
["activate"]: RegisteredConvexFunction.register({ ...definitions["activate"], handler: forward(definitions["activate"].handler) }),
["prepareRecovery"]: RegisteredConvexFunction.register({ ...definitions["prepareRecovery"], handler: forward(definitions["prepareRecovery"].handler) }),
["activateRecovery"]: RegisteredConvexFunction.register({ ...definitions["activateRecovery"], handler: forward(definitions["activateRecovery"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/activate.spec")["default"]>;
