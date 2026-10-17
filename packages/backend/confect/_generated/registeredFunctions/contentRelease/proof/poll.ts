import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/proof/poll.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/proof/poll.spec")["default"]>(databaseSchema, groupLayer);

export default {
["poll"]: RegisteredConvexFunction.register({ ...definitions["poll"], handler: forward(definitions["poll"].handler) }),
["status"]: RegisteredConvexFunction.register({ ...definitions["status"], handler: forward(definitions["status"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/proof/poll.spec")["default"]>;
