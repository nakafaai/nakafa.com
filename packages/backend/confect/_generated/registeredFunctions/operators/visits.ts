import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../operators/visits.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../operators/visits.spec")["default"]>(databaseSchema, groupLayer);

export default {
["request"]: RegisteredConvexFunction.register({ ...definitions["request"], handler: forward(definitions["request"].handler) }),
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["approve"]: RegisteredConvexFunction.register({ ...definitions["approve"], handler: forward(definitions["approve"].handler) }),
["decline"]: RegisteredConvexFunction.register({ ...definitions["decline"], handler: forward(definitions["decline"].handler) }),
["end"]: RegisteredConvexFunction.register({ ...definitions["end"], handler: forward(definitions["end"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../operators/visits.spec")["default"]>;
