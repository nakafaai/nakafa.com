import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/seed.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/seed.spec")["default"]>(databaseSchema, groupLayer);

export default {
["sitting"]: RegisteredConvexFunction.register({ ...definitions["sitting"], handler: forward(definitions["sitting"].handler) }),
["load"]: RegisteredConvexFunction.register({ ...definitions["load"], handler: forward(definitions["load"].handler) }),
["seats"]: RegisteredConvexFunction.register({ ...definitions["seats"], handler: forward(definitions["seats"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/seed.spec")["default"]>;
