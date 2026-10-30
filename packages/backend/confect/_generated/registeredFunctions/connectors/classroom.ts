import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../connectors/classroom.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../connectors/classroom.spec")["default"]>(databaseSchema, groupLayer);

export default {
["canImport"]: RegisteredConvexFunction.register({ ...definitions["canImport"], handler: forward(definitions["canImport"].handler) }),
["preview"]: RegisteredConvexFunction.register({ ...definitions["preview"], handler: forward(definitions["preview"].handler) }),
["link"]: RegisteredConvexFunction.register({ ...definitions["link"], handler: forward(definitions["link"].handler) }),
["target"]: RegisteredConvexFunction.register({ ...definitions["target"], handler: forward(definitions["target"].handler) }),
["links"]: RegisteredConvexFunction.register({ ...definitions["links"], handler: forward(definitions["links"].handler) }),
["storeWork"]: RegisteredConvexFunction.register({ ...definitions["storeWork"], handler: forward(definitions["storeWork"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../connectors/classroom.spec")["default"]>;
