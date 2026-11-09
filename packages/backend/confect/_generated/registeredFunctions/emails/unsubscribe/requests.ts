import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/unsubscribe/requests.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../emails/unsubscribe/requests.spec")["default"]>(databaseSchema, groupLayer);

export default {
["confirm"]: RegisteredConvexFunction.register({ ...definitions["confirm"], handler: forward(definitions["confirm"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../emails/unsubscribe/requests.spec")["default"]>;
