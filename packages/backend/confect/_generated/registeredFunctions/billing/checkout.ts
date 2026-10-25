import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/checkout.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/checkout.spec")["default"]>(databaseSchema, groupLayer);

export default {
["openAccount"]: RegisteredConvexFunction.register({ ...definitions["openAccount"], handler: forward(definitions["openAccount"].handler) }),
["recordCustomer"]: RegisteredConvexFunction.register({ ...definitions["recordCustomer"], handler: forward(definitions["recordCustomer"].handler) }),
["admitCheckout"]: RegisteredConvexFunction.register({ ...definitions["admitCheckout"], handler: forward(definitions["admitCheckout"].handler) }),
["holdsPro"]: RegisteredConvexFunction.register({ ...definitions["holdsPro"], handler: forward(definitions["holdsPro"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/checkout.spec")["default"]>;
