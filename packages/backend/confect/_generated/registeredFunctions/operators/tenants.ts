import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../operators/tenants.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../operators/tenants.spec")["default"]>(databaseSchema, groupLayer);

export default {
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
["suspend"]: RegisteredConvexFunction.register({ ...definitions["suspend"], handler: forward(definitions["suspend"].handler) }),
["reactivate"]: RegisteredConvexFunction.register({ ...definitions["reactivate"], handler: forward(definitions["reactivate"].handler) }),
["replaceOwner"]: RegisteredConvexFunction.register({ ...definitions["replaceOwner"], handler: forward(definitions["replaceOwner"].handler) }),
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../operators/tenants.spec")["default"]>;
