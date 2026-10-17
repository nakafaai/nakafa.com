import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/uploads.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../nina/uploads.spec")["default"]>(databaseSchema, groupLayer);

export default {
["save"]: RegisteredConvexFunction.register({ ...definitions["save"], handler: forward(definitions["save"].handler) }),
["release"]: RegisteredConvexFunction.register({ ...definitions["release"], handler: forward(definitions["release"].handler) }),
["reserve"]: RegisteredConvexFunction.register({ ...definitions["reserve"], handler: forward(definitions["reserve"].handler) }),
["complete"]: RegisteredConvexFunction.register({ ...definitions["complete"], handler: forward(definitions["complete"].handler) }),
["discard"]: RegisteredConvexFunction.register({ ...definitions["discard"], handler: forward(definitions["discard"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../nina/uploads.spec")["default"]>;
