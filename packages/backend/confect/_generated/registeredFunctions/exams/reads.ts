import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/reads.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/reads.spec")["default"]>(databaseSchema, groupLayer);

export default {
["canRead"]: RegisteredConvexFunction.register({ ...definitions["canRead"], handler: forward(definitions["canRead"].handler) }),
["read"]: RegisteredConvexFunction.register({ ...definitions["read"], handler: forward(definitions["read"].handler) }),
["pictures"]: RegisteredConvexFunction.register({ ...definitions["pictures"], handler: forward(definitions["pictures"].handler) }),
["discard"]: RegisteredConvexFunction.register({ ...definitions["discard"], handler: forward(definitions["discard"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/reads.spec")["default"]>;
