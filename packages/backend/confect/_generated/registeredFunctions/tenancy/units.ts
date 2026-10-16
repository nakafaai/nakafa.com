import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/units.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/units.spec")["default"]>(databaseSchema, groupLayer);

export default {
["setLocale"]: RegisteredConvexFunction.register({ ...definitions["setLocale"], handler: forward(definitions["setLocale"].handler) }),
["archive"]: RegisteredConvexFunction.register({ ...definitions["archive"], handler: forward(definitions["archive"].handler) }),
["unarchive"]: RegisteredConvexFunction.register({ ...definitions["unarchive"], handler: forward(definitions["unarchive"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/units.spec")["default"]>;
