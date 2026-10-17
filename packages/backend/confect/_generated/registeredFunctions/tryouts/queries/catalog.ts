import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tryouts/queries/catalog.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tryouts/queries/catalog.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getFeaturedQuestion"]: RegisteredConvexFunction.register({ ...definitions["getFeaturedQuestion"], handler: forward(definitions["getFeaturedQuestion"].handler) }),
["getMetadata"]: RegisteredConvexFunction.register({ ...definitions["getMetadata"], handler: forward(definitions["getMetadata"].handler) }),
["getLocalizedPath"]: RegisteredConvexFunction.register({ ...definitions["getLocalizedPath"], handler: forward(definitions["getLocalizedPath"].handler) }),
["getHubPage"]: RegisteredConvexFunction.register({ ...definitions["getHubPage"], handler: forward(definitions["getHubPage"].handler) }),
["getCountryPage"]: RegisteredConvexFunction.register({ ...definitions["getCountryPage"], handler: forward(definitions["getCountryPage"].handler) }),
["getExamPage"]: RegisteredConvexFunction.register({ ...definitions["getExamPage"], handler: forward(definitions["getExamPage"].handler) }),
["getTrackPage"]: RegisteredConvexFunction.register({ ...definitions["getTrackPage"], handler: forward(definitions["getTrackPage"].handler) }),
["getSetPage"]: RegisteredConvexFunction.register({ ...definitions["getSetPage"], handler: forward(definitions["getSetPage"].handler) }),
["getSectionPage"]: RegisteredConvexFunction.register({ ...definitions["getSectionPage"], handler: forward(definitions["getSectionPage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tryouts/queries/catalog.spec")["default"]>;
