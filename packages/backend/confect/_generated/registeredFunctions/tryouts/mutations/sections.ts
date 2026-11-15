import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/mutations/sections.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/mutations/sections.spec")["default"]>(databaseSchema, groupLayer);

export default {
["start"]: RegisteredConvexFunction.register({ ...definitions["start"], handler: forward(definitions["start"].handler) }),
["complete"]: RegisteredConvexFunction.register({ ...definitions["complete"], handler: forward(definitions["complete"].handler) }),
["chooseQuestionLanguage"]: RegisteredConvexFunction.register({ ...definitions["chooseQuestionLanguage"], handler: forward(definitions["chooseQuestionLanguage"].handler) }),
["countQuestionLook"]: RegisteredConvexFunction.register({ ...definitions["countQuestionLook"], handler: forward(definitions["countQuestionLook"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/mutations/sections.spec")["default"]>;
