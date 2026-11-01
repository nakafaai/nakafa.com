import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../integrations/webhooks.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../integrations/webhooks.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["deliveries"]: RegisteredConvexFunction.register({ ...definitions["deliveries"], handler: forward(definitions["deliveries"].handler) }),
["create"]: RegisteredConvexFunction.register({ ...definitions["create"], handler: forward(definitions["create"].handler) }),
["change"]: RegisteredConvexFunction.register({ ...definitions["change"], handler: forward(definitions["change"].handler) }),
["rotate"]: RegisteredConvexFunction.register({ ...definitions["rotate"], handler: forward(definitions["rotate"].handler) }),
["revoke"]: RegisteredConvexFunction.register({ ...definitions["revoke"], handler: forward(definitions["revoke"].handler) }),
["resend"]: RegisteredConvexFunction.register({ ...definitions["resend"], handler: forward(definitions["resend"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../integrations/webhooks.spec")["default"]>;
