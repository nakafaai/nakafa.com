import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/questions.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/questions.spec")["default"]>(databaseSchema, groupLayer);

export default {
["add"]: RegisteredConvexFunction.register({ ...definitions["add"], handler: forward(definitions["add"].handler) }),
["copy"]: RegisteredConvexFunction.register({ ...definitions["copy"], handler: forward(definitions["copy"].handler) }),
["remove"]: RegisteredConvexFunction.register({ ...definitions["remove"], handler: forward(definitions["remove"].handler) }),
["move"]: RegisteredConvexFunction.register({ ...definitions["move"], handler: forward(definitions["move"].handler) }),
["points"]: RegisteredConvexFunction.register({ ...definitions["points"], handler: forward(definitions["points"].handler) }),
["answer"]: RegisteredConvexFunction.register({ ...definitions["answer"], handler: forward(definitions["answer"].handler) }),
["template"]: RegisteredConvexFunction.register({ ...definitions["template"], handler: forward(definitions["template"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/questions.spec")["default"]>;
