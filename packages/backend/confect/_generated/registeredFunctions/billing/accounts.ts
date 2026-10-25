import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/accounts.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/accounts.spec")["default"]>(databaseSchema, groupLayer);

export default {
["linkPolarCustomer"]: RegisteredConvexFunction.register({ ...definitions["linkPolarCustomer"], handler: forward(definitions["linkPolarCustomer"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/accounts.spec")["default"]>;
