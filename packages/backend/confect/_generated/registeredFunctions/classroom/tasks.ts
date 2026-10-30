import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/tasks.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/tasks.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["get"]: RegisteredConvexFunction.register({ ...definitions["get"], handler: forward(definitions["get"].handler) }),
["publish"]: RegisteredConvexFunction.register({ ...definitions["publish"], handler: forward(definitions["publish"].handler) }),
["reschedule"]: RegisteredConvexFunction.register({ ...definitions["reschedule"], handler: forward(definitions["reschedule"].handler) }),
["submit"]: RegisteredConvexFunction.register({ ...definitions["submit"], handler: forward(definitions["submit"].handler) }),
["submissions"]: RegisteredConvexFunction.register({ ...definitions["submissions"], handler: forward(definitions["submissions"].handler) }),
["score"]: RegisteredConvexFunction.register({ ...definitions["score"], handler: forward(definitions["score"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/tasks.spec")["default"]>;
