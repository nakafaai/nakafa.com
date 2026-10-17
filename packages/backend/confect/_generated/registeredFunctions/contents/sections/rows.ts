import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/sections/rows.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contents/sections/rows.spec")["default"]>(databaseSchema, groupLayer);

export default {
["lessons"]: RegisteredConvexFunction.register({ ...definitions["lessons"], handler: forward(definitions["lessons"].handler) }),
["surah"]: RegisteredConvexFunction.register({ ...definitions["surah"], handler: forward(definitions["surah"].handler) }),
["stored"]: RegisteredConvexFunction.register({ ...definitions["stored"], handler: forward(definitions["stored"].handler) }),
["save"]: RegisteredConvexFunction.register({ ...definitions["save"], handler: forward(definitions["save"].handler) }),
["prune"]: RegisteredConvexFunction.register({ ...definitions["prune"], handler: forward(definitions["prune"].handler) }),
["finish"]: RegisteredConvexFunction.register({ ...definitions["finish"], handler: forward(definitions["finish"].handler) }),
["page"]: RegisteredConvexFunction.register({ ...definitions["page"], handler: forward(definitions["page"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contents/sections/rows.spec")["default"]>;
