import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../connectors/google.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../connectors/google.spec")["default"]>(databaseSchema, groupLayer);

export default {
["offered"]: RegisteredConvexFunction.register({ ...definitions["offered"], handler: forward(definitions["offered"].handler) }),
["startPersonal"]: RegisteredConvexFunction.register({ ...definitions["startPersonal"], handler: forward(definitions["startPersonal"].handler) }),
["startSchool"]: RegisteredConvexFunction.register({ ...definitions["startSchool"], handler: forward(definitions["startSchool"].handler) }),
["finish"]: RegisteredConvexFunction.register({ ...definitions["finish"], handler: forward(definitions["finish"].handler) }),
["claim"]: RegisteredConvexFunction.register({ ...definitions["claim"], handler: forward(definitions["claim"].handler) }),
["store"]: RegisteredConvexFunction.register({ ...definitions["store"], handler: forward(definitions["store"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../connectors/google.spec")["default"]>;
