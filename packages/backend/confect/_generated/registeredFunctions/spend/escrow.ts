import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../spend/escrow.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../spend/escrow.spec")["default"]>(databaseSchema, groupLayer);

export default {
["hold"]: RegisteredConvexFunction.register({ ...definitions["hold"], handler: forward(definitions["hold"].handler) }),
["settle"]: RegisteredConvexFunction.register({ ...definitions["settle"], handler: forward(definitions["settle"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../spend/escrow.spec")["default"]>;
