import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../learningPreferences/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../learningPreferences/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["listCurriculumPrograms"]: RegisteredConvexFunction.register({ ...definitions["listCurriculumPrograms"], handler: forward(definitions["listCurriculumPrograms"].handler) }),
["getCurrent"]: RegisteredConvexFunction.register({ ...definitions["getCurrent"], handler: forward(definitions["getCurrent"].handler) }),
["getCurrentTryout"]: RegisteredConvexFunction.register({ ...definitions["getCurrentTryout"], handler: forward(definitions["getCurrentTryout"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../learningPreferences/queries.spec")["default"]>;
