import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/mutations/access.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/mutations/access.spec")["default"]>(databaseSchema, groupLayer);

export default {
["trackPaywallView"]: RegisteredConvexFunction.register({ ...definitions["trackPaywallView"], handler: forward(definitions["trackPaywallView"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/mutations/access.spec")["default"]>;
