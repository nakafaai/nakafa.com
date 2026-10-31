import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/screens.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/screens.spec")["default"]>(databaseSchema, groupLayer);

export default {
["look"]: RegisteredConvexFunction.register({ ...definitions["look"], handler: forward(definitions["look"].handler) }),
["screen"]: RegisteredConvexFunction.register({ ...definitions["screen"], handler: forward(definitions["screen"].handler) }),
["beat"]: RegisteredConvexFunction.register({ ...definitions["beat"], handler: forward(definitions["beat"].handler) }),
["offline"]: RegisteredConvexFunction.register({ ...definitions["offline"], handler: forward(definitions["offline"].handler) }),
["seats"]: RegisteredConvexFunction.register({ ...definitions["seats"], handler: forward(definitions["seats"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/screens.spec")["default"]>;
