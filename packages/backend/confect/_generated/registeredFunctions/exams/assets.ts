import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/assets.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/assets.spec")["default"]>(databaseSchema, groupLayer);

export default {
["uploadUrl"]: RegisteredConvexFunction.register({ ...definitions["uploadUrl"], handler: forward(definitions["uploadUrl"].handler) }),
["canAdd"]: RegisteredConvexFunction.register({ ...definitions["canAdd"], handler: forward(definitions["canAdd"].handler) }),
["register"]: RegisteredConvexFunction.register({ ...definitions["register"], handler: forward(definitions["register"].handler) }),
["urls"]: RegisteredConvexFunction.register({ ...definitions["urls"], handler: forward(definitions["urls"].handler) }),
["commit"]: RegisteredConvexFunction.register({ ...definitions["commit"], handler: forward(definitions["commit"].handler) }),
["discard"]: RegisteredConvexFunction.register({ ...definitions["discard"], handler: forward(definitions["discard"].handler) }),
["removeForExam"]: RegisteredConvexFunction.register({ ...definitions["removeForExam"], handler: forward(definitions["removeForExam"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/assets.spec")["default"]>;
