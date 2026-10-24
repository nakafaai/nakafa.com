import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/queries/attemptPage.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/queries/attemptPage.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getSet"]: RegisteredConvexFunction.register({ ...definitions["getSet"], handler: forward(definitions["getSet"].handler) }),
["getSection"]: RegisteredConvexFunction.register({ ...definitions["getSection"], handler: forward(definitions["getSection"].handler) }),
["getSectionWithBodies"]: RegisteredConvexFunction.register({ ...definitions["getSectionWithBodies"], handler: forward(definitions["getSectionWithBodies"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/queries/attemptPage.spec")["default"]>;
