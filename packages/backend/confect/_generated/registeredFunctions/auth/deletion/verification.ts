import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../auth/deletion/verification.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../auth/deletion/verification.spec")["default"]>(databaseSchema, groupLayer);

export default {
["loadDeletedUserVerificationCursor"]: RegisteredConvexFunction.register({ ...definitions["loadDeletedUserVerificationCursor"], handler: forward(definitions["loadDeletedUserVerificationCursor"].handler) }),
["saveDeletedUserVerificationCursor"]: RegisteredConvexFunction.register({ ...definitions["saveDeletedUserVerificationCursor"], handler: forward(definitions["saveDeletedUserVerificationCursor"].handler) }),
["drainDeletedUserVerifications"]: RegisteredConvexFunction.register({ ...definitions["drainDeletedUserVerifications"], handler: forward(definitions["drainDeletedUserVerifications"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../auth/deletion/verification.spec")["default"]>;
