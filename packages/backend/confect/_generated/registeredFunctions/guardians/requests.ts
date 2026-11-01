import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../guardians/requests.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../guardians/requests.spec")["default"]>(databaseSchema, groupLayer);

export default {
["ask"]: RegisteredConvexFunction.register({ ...definitions["ask"], handler: forward(definitions["ask"].handler) }),
["ofLink"]: RegisteredConvexFunction.register({ ...definitions["ofLink"], handler: forward(definitions["ofLink"].handler) }),
["waiting"]: RegisteredConvexFunction.register({ ...definitions["waiting"], handler: forward(definitions["waiting"].handler) }),
["answer"]: RegisteredConvexFunction.register({ ...definitions["answer"], handler: forward(definitions["answer"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../guardians/requests.spec")["default"]>;
