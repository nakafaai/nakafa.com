import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/mutations/expiry.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/mutations/expiry.spec")["default"]>(databaseSchema, groupLayer);

export default {
["attempt"]: RegisteredConvexFunction.register({ ...definitions["attempt"], handler: forward(definitions["attempt"].handler) }),
["section"]: RegisteredConvexFunction.register({ ...definitions["section"], handler: forward(definitions["section"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
["reconcileAttempts"]: RegisteredConvexFunction.register({ ...definitions["reconcileAttempts"], handler: forward(definitions["reconcileAttempts"].handler) }),
["reconcileSections"]: RegisteredConvexFunction.register({ ...definitions["reconcileSections"], handler: forward(definitions["reconcileSections"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/mutations/expiry.spec")["default"]>;
