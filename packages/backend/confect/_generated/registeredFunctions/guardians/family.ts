import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../guardians/family.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../guardians/family.spec")["default"]>(databaseSchema, groupLayer);

export default {
["children"]: RegisteredConvexFunction.register({ ...definitions["children"], handler: forward(definitions["children"].handler) }),
["confirm"]: RegisteredConvexFunction.register({ ...definitions["confirm"], handler: forward(definitions["confirm"].handler) }),
["withdraw"]: RegisteredConvexFunction.register({ ...definitions["withdraw"], handler: forward(definitions["withdraw"].handler) }),
["grades"]: RegisteredConvexFunction.register({ ...definitions["grades"], handler: forward(definitions["grades"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../guardians/family.spec")["default"]>;
