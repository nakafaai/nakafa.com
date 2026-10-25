import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/units.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/units.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["setNpsn"]: RegisteredConvexFunction.register({ ...definitions["setNpsn"], handler: forward(definitions["setNpsn"].handler) }),
["setLocale"]: RegisteredConvexFunction.register({ ...definitions["setLocale"], handler: forward(definitions["setLocale"].handler) }),
["create"]: RegisteredConvexFunction.register({ ...definitions["create"], handler: forward(definitions["create"].handler) }),
["archive"]: RegisteredConvexFunction.register({ ...definitions["archive"], handler: forward(definitions["archive"].handler) }),
["unarchive"]: RegisteredConvexFunction.register({ ...definitions["unarchive"], handler: forward(definitions["unarchive"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/units.spec")["default"]>;
