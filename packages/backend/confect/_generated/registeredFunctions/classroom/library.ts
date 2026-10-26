import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/library.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/library.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["addLink"]: RegisteredConvexFunction.register({ ...definitions["addLink"], handler: forward(definitions["addLink"].handler) }),
["uploadUrl"]: RegisteredConvexFunction.register({ ...definitions["uploadUrl"], handler: forward(definitions["uploadUrl"].handler) }),
["canAdd"]: RegisteredConvexFunction.register({ ...definitions["canAdd"], handler: forward(definitions["canAdd"].handler) }),
["register"]: RegisteredConvexFunction.register({ ...definitions["register"], handler: forward(definitions["register"].handler) }),
["remove"]: RegisteredConvexFunction.register({ ...definitions["remove"], handler: forward(definitions["remove"].handler) }),
["commit"]: RegisteredConvexFunction.register({ ...definitions["commit"], handler: forward(definitions["commit"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/library.spec")["default"]>;
