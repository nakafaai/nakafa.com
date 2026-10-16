import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../auth/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getCurrentUser"]: RegisteredConvexFunction.register({ ...definitions["getCurrentUser"], handler: forward(definitions["getCurrentUser"].handler) }),
["getUserById"]: RegisteredConvexFunction.register({ ...definitions["getUserById"], handler: forward(definitions["getUserById"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../auth/queries.spec")["default"]>;
