import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/posts.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/posts.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["publish"]: RegisteredConvexFunction.register({ ...definitions["publish"], handler: forward(definitions["publish"].handler) }),
["edit"]: RegisteredConvexFunction.register({ ...definitions["edit"], handler: forward(definitions["edit"].handler) }),
["remove"]: RegisteredConvexFunction.register({ ...definitions["remove"], handler: forward(definitions["remove"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/posts.spec")["default"]>;
