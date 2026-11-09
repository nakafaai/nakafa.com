import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../comments/files.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../comments/files.spec")["default"]>(databaseSchema, groupLayer);

export default {
["reserve"]: RegisteredConvexFunction.register({ ...definitions["reserve"], handler: forward(definitions["reserve"].handler) }),
["register"]: RegisteredConvexFunction.register({ ...definitions["register"], handler: forward(definitions["register"].handler) }),
["withdraw"]: RegisteredConvexFunction.register({ ...definitions["withdraw"], handler: forward(definitions["withdraw"].handler) }),
["commit"]: RegisteredConvexFunction.register({ ...definitions["commit"], handler: forward(definitions["commit"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../comments/files.spec")["default"]>;
