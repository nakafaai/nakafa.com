import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../connectors/events.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../connectors/events.spec")["default"]>(databaseSchema, groupLayer);

export default {
["upcoming"]: RegisteredConvexFunction.register({ ...definitions["upcoming"], handler: forward(definitions["upcoming"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../connectors/events.spec")["default"]>;
