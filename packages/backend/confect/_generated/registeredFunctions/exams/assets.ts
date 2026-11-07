import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/assets.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/assets.spec")["default"]>(databaseSchema, groupLayer);

export default {
["reserve"]: RegisteredConvexFunction.register({ ...definitions["reserve"], handler: forward(definitions["reserve"].handler) }),
["canAdd"]: RegisteredConvexFunction.register({ ...definitions["canAdd"], handler: forward(definitions["canAdd"].handler) }),
["register"]: RegisteredConvexFunction.register({ ...definitions["register"], handler: forward(definitions["register"].handler) }),
["registerAudio"]: RegisteredConvexFunction.register({ ...definitions["registerAudio"], handler: forward(definitions["registerAudio"].handler) }),
["media"]: RegisteredConvexFunction.register({ ...definitions["media"], handler: forward(definitions["media"].handler) }),
["urls"]: RegisteredConvexFunction.register({ ...definitions["urls"], handler: forward(definitions["urls"].handler) }),
["commit"]: RegisteredConvexFunction.register({ ...definitions["commit"], handler: forward(definitions["commit"].handler) }),
["commitAudio"]: RegisteredConvexFunction.register({ ...definitions["commitAudio"], handler: forward(definitions["commitAudio"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/assets.spec")["default"]>;
