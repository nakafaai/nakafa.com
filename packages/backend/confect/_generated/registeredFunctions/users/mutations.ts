import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../users/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../users/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["updateUserRole"]: RegisteredConvexFunction.register({ ...definitions["updateUserRole"], handler: forward(definitions["updateUserRole"].handler) }),
["updateUserName"]: RegisteredConvexFunction.register({ ...definitions["updateUserName"], handler: forward(definitions["updateUserName"].handler) }),
["updateUsername"]: RegisteredConvexFunction.register({ ...definitions["updateUsername"], handler: forward(definitions["updateUsername"].handler) }),
["updateBio"]: RegisteredConvexFunction.register({ ...definitions["updateBio"], handler: forward(definitions["updateBio"].handler) }),
["setMascot"]: RegisteredConvexFunction.register({ ...definitions["setMascot"], handler: forward(definitions["setMascot"].handler) }),
["setPicture"]: RegisteredConvexFunction.register({ ...definitions["setPicture"], handler: forward(definitions["setPicture"].handler) }),
["syncUserInfoForChat"]: RegisteredConvexFunction.register({ ...definitions["syncUserInfoForChat"], handler: forward(definitions["syncUserInfoForChat"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../users/mutations.spec")["default"]>;
