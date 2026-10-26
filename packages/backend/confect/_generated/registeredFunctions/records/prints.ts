import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../records/prints.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../records/prints.spec")["default"]>(databaseSchema, groupLayer);

export default {
["printable"]: RegisteredConvexFunction.register({ ...definitions["printable"], handler: forward(definitions["printable"].handler) }),
["lock"]: RegisteredConvexFunction.register({ ...definitions["lock"], handler: forward(definitions["lock"].handler) }),
["draw"]: RegisteredConvexFunction.register({ ...definitions["draw"], handler: forward(definitions["draw"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../records/prints.spec")["default"]>;
