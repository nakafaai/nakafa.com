import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/scheduled.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/scheduled.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["schedule"]: RegisteredConvexFunction.register({ ...definitions["schedule"], handler: forward(definitions["schedule"].handler) }),
["edit"]: RegisteredConvexFunction.register({ ...definitions["edit"], handler: forward(definitions["edit"].handler) }),
["cancel"]: RegisteredConvexFunction.register({ ...definitions["cancel"], handler: forward(definitions["cancel"].handler) }),
["release"]: RegisteredConvexFunction.register({ ...definitions["release"], handler: forward(definitions["release"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/scheduled.spec")["default"]>;
