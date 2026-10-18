import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../records/grades.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../records/grades.spec")["default"]>(databaseSchema, groupLayer);

export default {
["enter"]: RegisteredConvexFunction.register({ ...definitions["enter"], handler: forward(definitions["enter"].handler) }),
["release"]: RegisteredConvexFunction.register({ ...definitions["release"], handler: forward(definitions["release"].handler) }),
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["mine"]: RegisteredConvexFunction.register({ ...definitions["mine"], handler: forward(definitions["mine"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../records/grades.spec")["default"]>;
