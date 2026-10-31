import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../records/letters.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../records/letters.spec")["default"]>(databaseSchema, groupLayer);

export default {
["printable"]: RegisteredConvexFunction.register({ ...definitions["printable"], handler: forward(definitions["printable"].handler) }),
["lock"]: RegisteredConvexFunction.register({ ...definitions["lock"], handler: forward(definitions["lock"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../records/letters.spec")["default"]>;
