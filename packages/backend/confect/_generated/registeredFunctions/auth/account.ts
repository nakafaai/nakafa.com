import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/account.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../auth/account.spec")["default"]>(databaseSchema, groupLayer);

export default {
["createGoogle"]: RegisteredConvexFunction.register({ ...definitions["createGoogle"], handler: forward(definitions["createGoogle"].handler) }),
["signInGoogle"]: RegisteredConvexFunction.register({ ...definitions["signInGoogle"], handler: forward(definitions["signInGoogle"].handler) }),
["createSchool"]: RegisteredConvexFunction.register({ ...definitions["createSchool"], handler: forward(definitions["createSchool"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../auth/account.spec")["default"]>;
