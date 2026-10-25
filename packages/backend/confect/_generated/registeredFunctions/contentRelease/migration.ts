import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/migration.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/migration.spec")["default"]>(databaseSchema, groupLayer);

export default {
["markRetiredGeneration"]: RegisteredConvexFunction.register({ ...definitions["markRetiredGeneration"], handler: forward(definitions["markRetiredGeneration"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/migration.spec")["default"]>;
