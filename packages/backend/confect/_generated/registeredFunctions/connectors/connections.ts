import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../connectors/connections.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../connectors/connections.spec")["default"]>(databaseSchema, groupLayer);

export default {
["listSchool"]: RegisteredConvexFunction.register({ ...definitions["listSchool"], handler: forward(definitions["listSchool"].handler) }),
["listOwn"]: RegisteredConvexFunction.register({ ...definitions["listOwn"], handler: forward(definitions["listOwn"].handler) }),
["disconnectSchool"]: RegisteredConvexFunction.register({ ...definitions["disconnectSchool"], handler: forward(definitions["disconnectSchool"].handler) }),
["disconnectOwn"]: RegisteredConvexFunction.register({ ...definitions["disconnectOwn"], handler: forward(definitions["disconnectOwn"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../connectors/connections.spec")["default"]>;
