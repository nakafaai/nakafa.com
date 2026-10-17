import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/deletion.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../auth/deletion.spec")["default"]>(databaseSchema, groupLayer);

export default {
["claimAccountDeletion"]: RegisteredConvexFunction.register({ ...definitions["claimAccountDeletion"], handler: forward(definitions["claimAccountDeletion"].handler) }),
["continueAccountDeletionCommit"]: RegisteredConvexFunction.register({ ...definitions["continueAccountDeletionCommit"], handler: forward(definitions["continueAccountDeletionCommit"].handler) }),
["prepareCurrentAccountDeletion"]: RegisteredConvexFunction.register({ ...definitions["prepareCurrentAccountDeletion"], handler: forward(definitions["prepareCurrentAccountDeletion"].handler) }),
["cancelAccountDeletion"]: RegisteredConvexFunction.register({ ...definitions["cancelAccountDeletion"], handler: forward(definitions["cancelAccountDeletion"].handler) }),
["cancelAccountDeletionAttempt"]: RegisteredConvexFunction.register({ ...definitions["cancelAccountDeletionAttempt"], handler: forward(definitions["cancelAccountDeletionAttempt"].handler) }),
["getAccountDeletionAttemptStatus"]: RegisteredConvexFunction.register({ ...definitions["getAccountDeletionAttemptStatus"], handler: forward(definitions["getAccountDeletionAttemptStatus"].handler) }),
["sweepAccountDeletionRetention"]: RegisteredConvexFunction.register({ ...definitions["sweepAccountDeletionRetention"], handler: forward(definitions["sweepAccountDeletionRetention"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../auth/deletion.spec")["default"]>;
