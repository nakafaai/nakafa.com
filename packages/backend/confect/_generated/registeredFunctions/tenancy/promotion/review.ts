import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tenancy/promotion/review.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tenancy/promotion/review.spec")["default"]>(databaseSchema, groupLayer);

export default {
["submit"]: RegisteredConvexFunction.register({ ...definitions["submit"], handler: forward(definitions["submit"].handler) }),
["approve"]: RegisteredConvexFunction.register({ ...definitions["approve"], handler: forward(definitions["approve"].handler) }),
["returnToDraft"]: RegisteredConvexFunction.register({ ...definitions["returnToDraft"], handler: forward(definitions["returnToDraft"].handler) }),
["cancel"]: RegisteredConvexFunction.register({ ...definitions["cancel"], handler: forward(definitions["cancel"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tenancy/promotion/review.spec")["default"]>;
