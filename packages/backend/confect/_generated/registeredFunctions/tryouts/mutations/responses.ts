import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/mutations/responses.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/mutations/responses.spec")["default"]>(databaseSchema, groupLayer);

export default {
["save"]: RegisteredConvexFunction.register({ ...definitions["save"], handler: forward(definitions["save"].handler) }),
["flag"]: RegisteredConvexFunction.register({ ...definitions["flag"], handler: forward(definitions["flag"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/mutations/responses.spec")["default"]>;
