import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../users/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../users/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getUserById"]: RegisteredConvexFunction.register({ ...definitions["getUserById"], handler: forward(definitions["getUserById"].handler) }),
["getUserByAuthId"]: RegisteredConvexFunction.register({ ...definitions["getUserByAuthId"], handler: forward(definitions["getUserByAuthId"].handler) }),
["checkUsername"]: RegisteredConvexFunction.register({ ...definitions["checkUsername"], handler: forward(definitions["checkUsername"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../users/queries.spec")["default"]>;
