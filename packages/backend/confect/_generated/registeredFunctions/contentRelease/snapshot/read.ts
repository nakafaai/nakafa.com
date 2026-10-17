import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/snapshot/read.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/snapshot/read.spec")["default"]>(databaseSchema, groupLayer);

export default {
["manifest"]: RegisteredConvexFunction.register({ ...definitions["manifest"], handler: forward(definitions["manifest"].handler) }),
["rows"]: RegisteredConvexFunction.register({ ...definitions["rows"], handler: forward(definitions["rows"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/snapshot/read.spec")["default"]>;
