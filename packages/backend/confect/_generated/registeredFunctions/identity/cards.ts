import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../identity/cards.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../identity/cards.spec")["default"]>(databaseSchema, groupLayer);

export default {
["enroll"]: RegisteredConvexFunction.register({ ...definitions["enroll"], handler: forward(definitions["enroll"].handler) }),
["issue"]: RegisteredConvexFunction.register({ ...definitions["issue"], handler: forward(definitions["issue"].handler) }),
["reissue"]: RegisteredConvexFunction.register({ ...definitions["reissue"], handler: forward(definitions["reissue"].handler) }),
["redeem"]: RegisteredConvexFunction.register({ ...definitions["redeem"], handler: forward(definitions["redeem"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../identity/cards.spec")["default"]>;
