import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/invite/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../emails/invite/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["readInput"]: RegisteredConvexFunction.register({ ...definitions["readInput"], handler: forward(definitions["readInput"].handler) }),
["enqueueRendered"]: RegisteredConvexFunction.register({ ...definitions["enqueueRendered"], handler: forward(definitions["enqueueRendered"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../emails/invite/internal.spec")["default"]>;
