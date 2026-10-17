import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/quran.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/quran.spec")["default"]>(databaseSchema, groupLayer);

export default {
["attribution"]: RegisteredConvexFunction.register({ ...definitions["attribution"], handler: forward(definitions["attribution"].handler) }),
["surahs"]: RegisteredConvexFunction.register({ ...definitions["surahs"], handler: forward(definitions["surahs"].handler) }),
["surah"]: RegisteredConvexFunction.register({ ...definitions["surah"], handler: forward(definitions["surah"].handler) }),
["prose"]: RegisteredConvexFunction.register({ ...definitions["prose"], handler: forward(definitions["prose"].handler) }),
["page"]: RegisteredConvexFunction.register({ ...definitions["page"], handler: forward(definitions["page"].handler) }),
["tafsir"]: RegisteredConvexFunction.register({ ...definitions["tafsir"], handler: forward(definitions["tafsir"].handler) }),
["passage"]: RegisteredConvexFunction.register({ ...definitions["passage"], handler: forward(definitions["passage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/quran.spec")["default"]>;
