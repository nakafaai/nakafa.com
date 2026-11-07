import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/folders.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/folders.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["add"]: RegisteredConvexFunction.register({ ...definitions["add"], handler: forward(definitions["add"].handler) }),
["rename"]: RegisteredConvexFunction.register({ ...definitions["rename"], handler: forward(definitions["rename"].handler) }),
["move"]: RegisteredConvexFunction.register({ ...definitions["move"], handler: forward(definitions["move"].handler) }),
["trash"]: RegisteredConvexFunction.register({ ...definitions["trash"], handler: forward(definitions["trash"].handler) }),
["restore"]: RegisteredConvexFunction.register({ ...definitions["restore"], handler: forward(definitions["restore"].handler) }),
["purge"]: RegisteredConvexFunction.register({ ...definitions["purge"], handler: forward(definitions["purge"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/folders.spec")["default"]>;
