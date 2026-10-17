import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../onboarding/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../onboarding/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["admit"]: RegisteredConvexFunction.register({ ...definitions["admit"], handler: forward(definitions["admit"].handler) }),
["saveAnswer"]: RegisteredConvexFunction.register({ ...definitions["saveAnswer"], handler: forward(definitions["saveAnswer"].handler) }),
["finish"]: RegisteredConvexFunction.register({ ...definitions["finish"], handler: forward(definitions["finish"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../onboarding/mutations.spec")["default"]>;
