import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/invites.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/invites.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["invite"]: RegisteredConvexFunction.register({ ...definitions["invite"], handler: forward(definitions["invite"].handler) }),
["revoke"]: RegisteredConvexFunction.register({ ...definitions["revoke"], handler: forward(definitions["revoke"].handler) }),
["resend"]: RegisteredConvexFunction.register({ ...definitions["resend"], handler: forward(definitions["resend"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/invites.spec")["default"]>;
