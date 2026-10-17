import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/summaries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../nina/summaries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["read"]: RegisteredConvexFunction.register({ ...definitions["read"], handler: forward(definitions["read"].handler) }),
["anchor"]: RegisteredConvexFunction.register({ ...definitions["anchor"], handler: forward(definitions["anchor"].handler) }),
["uncovered"]: RegisteredConvexFunction.register({ ...definitions["uncovered"], handler: forward(definitions["uncovered"].handler) }),
["asked"]: RegisteredConvexFunction.register({ ...definitions["asked"], handler: forward(definitions["asked"].handler) }),
["save"]: RegisteredConvexFunction.register({ ...definitions["save"], handler: forward(definitions["save"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../nina/summaries.spec")["default"]>;
