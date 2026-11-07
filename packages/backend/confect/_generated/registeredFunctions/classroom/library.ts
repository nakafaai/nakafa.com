import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/library.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/library.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["trashed"]: RegisteredConvexFunction.register({ ...definitions["trashed"], handler: forward(definitions["trashed"].handler) }),
["starred"]: RegisteredConvexFunction.register({ ...definitions["starred"], handler: forward(definitions["starred"].handler) }),
["search"]: RegisteredConvexFunction.register({ ...definitions["search"], handler: forward(definitions["search"].handler) }),
["addLink"]: RegisteredConvexFunction.register({ ...definitions["addLink"], handler: forward(definitions["addLink"].handler) }),
["reserve"]: RegisteredConvexFunction.register({ ...definitions["reserve"], handler: forward(definitions["reserve"].handler) }),
["canAdd"]: RegisteredConvexFunction.register({ ...definitions["canAdd"], handler: forward(definitions["canAdd"].handler) }),
["register"]: RegisteredConvexFunction.register({ ...definitions["register"], handler: forward(definitions["register"].handler) }),
["importDrive"]: RegisteredConvexFunction.register({ ...definitions["importDrive"], handler: forward(definitions["importDrive"].handler) }),
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
["edit"]: RegisteredConvexFunction.register({ ...definitions["edit"], handler: forward(definitions["edit"].handler) }),
["move"]: RegisteredConvexFunction.register({ ...definitions["move"], handler: forward(definitions["move"].handler) }),
["star"]: RegisteredConvexFunction.register({ ...definitions["star"], handler: forward(definitions["star"].handler) }),
["trash"]: RegisteredConvexFunction.register({ ...definitions["trash"], handler: forward(definitions["trash"].handler) }),
["restore"]: RegisteredConvexFunction.register({ ...definitions["restore"], handler: forward(definitions["restore"].handler) }),
["purge"]: RegisteredConvexFunction.register({ ...definitions["purge"], handler: forward(definitions["purge"].handler) }),
["upload"]: RegisteredConvexFunction.register({ ...definitions["upload"], handler: forward(definitions["upload"].handler) }),
["reserveImport"]: RegisteredConvexFunction.register({ ...definitions["reserveImport"], handler: forward(definitions["reserveImport"].handler) }),
["commit"]: RegisteredConvexFunction.register({ ...definitions["commit"], handler: forward(definitions["commit"].handler) }),
["discard"]: RegisteredConvexFunction.register({ ...definitions["discard"], handler: forward(definitions["discard"].handler) }),
["removeObjects"]: RegisteredConvexFunction.register({ ...definitions["removeObjects"], handler: forward(definitions["removeObjects"].handler) }),
["purgeRest"]: RegisteredConvexFunction.register({ ...definitions["purgeRest"], handler: forward(definitions["purgeRest"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/library.spec")["default"]>;
