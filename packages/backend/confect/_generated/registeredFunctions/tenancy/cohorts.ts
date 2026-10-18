import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/cohorts.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/cohorts.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["activePeriod"]: RegisteredConvexFunction.register({ ...definitions["activePeriod"], handler: forward(definitions["activePeriod"].handler) }),
["members"]: RegisteredConvexFunction.register({ ...definitions["members"], handler: forward(definitions["members"].handler) }),
["create"]: RegisteredConvexFunction.register({ ...definitions["create"], handler: forward(definitions["create"].handler) }),
["rename"]: RegisteredConvexFunction.register({ ...definitions["rename"], handler: forward(definitions["rename"].handler) }),
["archive"]: RegisteredConvexFunction.register({ ...definitions["archive"], handler: forward(definitions["archive"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/cohorts.spec")["default"]>;
