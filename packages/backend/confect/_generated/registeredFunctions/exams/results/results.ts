import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../exams/results/results.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../exams/results/results.spec")["default"]>(databaseSchema, groupLayer);

export default {
["overview"]: RegisteredConvexFunction.register({ ...definitions["overview"], handler: forward(definitions["overview"].handler) }),
["byStudent"]: RegisteredConvexFunction.register({ ...definitions["byStudent"], handler: forward(definitions["byStudent"].handler) }),
["byQuestion"]: RegisteredConvexFunction.register({ ...definitions["byQuestion"], handler: forward(definitions["byQuestion"].handler) }),
["questionStats"]: RegisteredConvexFunction.register({ ...definitions["questionStats"], handler: forward(definitions["questionStats"].handler) }),
["release"]: RegisteredConvexFunction.register({ ...definitions["release"], handler: forward(definitions["release"].handler) }),
["attempt"]: RegisteredConvexFunction.register({ ...definitions["attempt"], handler: forward(definitions["attempt"].handler) }),
["mine"]: RegisteredConvexFunction.register({ ...definitions["mine"], handler: forward(definitions["mine"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../exams/results/results.spec")["default"]>;
