import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/mutations/popularity.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contents/mutations/popularity.spec")["default"]>(databaseSchema, groupLayer);

export default {
["pruneLearningPopularity"]: RegisteredConvexFunction.register({ ...definitions["pruneLearningPopularity"], handler: forward(definitions["pruneLearningPopularity"].handler) }),
["scheduleLearningPopularityExpiries"]: RegisteredConvexFunction.register({ ...definitions["scheduleLearningPopularityExpiries"], handler: forward(definitions["scheduleLearningPopularityExpiries"].handler) }),
["scheduleLearningPopularityRefreshes"]: RegisteredConvexFunction.register({ ...definitions["scheduleLearningPopularityRefreshes"], handler: forward(definitions["scheduleLearningPopularityRefreshes"].handler) }),
["refreshLearningPopularityWindowPage"]: RegisteredConvexFunction.register({ ...definitions["refreshLearningPopularityWindowPage"], handler: forward(definitions["refreshLearningPopularityWindowPage"].handler) }),
["expireLearningPopularityWindowPage"]: RegisteredConvexFunction.register({ ...definitions["expireLearningPopularityWindowPage"], handler: forward(definitions["expireLearningPopularityWindowPage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contents/mutations/popularity.spec")["default"]>;
