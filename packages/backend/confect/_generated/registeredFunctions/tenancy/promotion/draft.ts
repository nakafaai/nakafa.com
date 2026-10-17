import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tenancy/promotion/draft.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tenancy/promotion/draft.spec")["default"]>(databaseSchema, groupLayer);

export default {
["get"]: RegisteredConvexFunction.register({ ...definitions["get"], handler: forward(definitions["get"].handler) }),
["create"]: RegisteredConvexFunction.register({ ...definitions["create"], handler: forward(definitions["create"].handler) }),
["plan"]: RegisteredConvexFunction.register({ ...definitions["plan"], handler: forward(definitions["plan"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tenancy/promotion/draft.spec")["default"]>;
