import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/exams.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/exams.spec")["default"]>(databaseSchema, groupLayer);

export default {
["create"]: RegisteredConvexFunction.register({ ...definitions["create"], handler: forward(definitions["create"].handler) }),
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
["rename"]: RegisteredConvexFunction.register({ ...definitions["rename"], handler: forward(definitions["rename"].handler) }),
["schedule"]: RegisteredConvexFunction.register({ ...definitions["schedule"], handler: forward(definitions["schedule"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/exams.spec")["default"]>;
