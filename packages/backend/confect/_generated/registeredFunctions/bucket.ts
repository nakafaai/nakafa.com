import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import groupLayer from "../../bucket.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../bucket.spec")["default"]>(databaseSchema, groupLayer);

export default {
["file"]: RegisteredConvexFunction.register({ ...definitions["file"], handler: forward(definitions["file"].handler) }),
["markStored"]: RegisteredConvexFunction.register({ ...definitions["markStored"], handler: forward(definitions["markStored"].handler) }),
["reserveStored"]: RegisteredConvexFunction.register({ ...definitions["reserveStored"], handler: forward(definitions["reserveStored"].handler) }),
["discard"]: RegisteredConvexFunction.register({ ...definitions["discard"], handler: forward(definitions["discard"].handler) }),
["removeObjects"]: RegisteredConvexFunction.register({ ...definitions["removeObjects"], handler: forward(definitions["removeObjects"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../bucket.spec")["default"]>;
