import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../progress/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../progress/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["growth"]: RegisteredConvexFunction.register({ ...definitions["growth"], handler: forward(definitions["growth"].handler) }),
["week"]: RegisteredConvexFunction.register({ ...definitions["week"], handler: forward(definitions["week"].handler) }),
["leaders"]: RegisteredConvexFunction.register({ ...definitions["leaders"], handler: forward(definitions["leaders"].handler) }),
["claims"]: RegisteredConvexFunction.register({ ...definitions["claims"], handler: forward(definitions["claims"].handler) }),
["medals"]: RegisteredConvexFunction.register({ ...definitions["medals"], handler: forward(definitions["medals"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../progress/queries.spec")["default"]>;
