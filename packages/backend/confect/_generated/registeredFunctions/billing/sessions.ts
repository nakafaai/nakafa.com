import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/sessions.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/sessions.spec")["default"]>(databaseSchema, groupLayer);

export default {
["generateCheckoutLink"]: RegisteredConvexFunction.register({ ...definitions["generateCheckoutLink"], handler: forward(definitions["generateCheckoutLink"].handler) }),
["generateTopupCheckoutLink"]: RegisteredConvexFunction.register({ ...definitions["generateTopupCheckoutLink"], handler: forward(definitions["generateTopupCheckoutLink"].handler) }),
["generateCustomerPortalUrl"]: RegisteredConvexFunction.register({ ...definitions["generateCustomerPortalUrl"], handler: forward(definitions["generateCustomerPortalUrl"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/sessions.spec")["default"]>;
