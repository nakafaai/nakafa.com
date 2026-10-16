import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/teachers.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/teachers.spec")["default"]>(databaseSchema, groupLayer);

export default {
["assign"]: RegisteredConvexFunction.register({ ...definitions["assign"], handler: forward(definitions["assign"].handler) }),
["remove"]: RegisteredConvexFunction.register({ ...definitions["remove"], handler: forward(definitions["remove"].handler) }),
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/teachers.spec")["default"]>;
