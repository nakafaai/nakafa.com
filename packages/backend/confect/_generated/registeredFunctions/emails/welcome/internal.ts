import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/welcome/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../emails/welcome/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["readIntentInput"]: RegisteredConvexFunction.register({ ...definitions["readIntentInput"], handler: forward(definitions["readIntentInput"].handler) }),
["enqueueRenderedWelcome"]: RegisteredConvexFunction.register({ ...definitions["enqueueRenderedWelcome"], handler: forward(definitions["enqueueRenderedWelcome"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../emails/welcome/internal.spec")["default"]>;
