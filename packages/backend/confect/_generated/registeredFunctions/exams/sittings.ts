import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../exams/sittings.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../exams/sittings.spec")["default"]>(databaseSchema, groupLayer);

export default {
["enter"]: RegisteredConvexFunction.register({ ...definitions["enter"], handler: forward(definitions["enter"].handler) }),
["signal"]: RegisteredConvexFunction.register({ ...definitions["signal"], handler: forward(definitions["signal"].handler) }),
["mine"]: RegisteredConvexFunction.register({ ...definitions["mine"], handler: forward(definitions["mine"].handler) }),
["dashboard"]: RegisteredConvexFunction.register({ ...definitions["dashboard"], handler: forward(definitions["dashboard"].handler) }),
["lock"]: RegisteredConvexFunction.register({ ...definitions["lock"], handler: forward(definitions["lock"].handler) }),
["unlock"]: RegisteredConvexFunction.register({ ...definitions["unlock"], handler: forward(definitions["unlock"].handler) }),
["addMinutes"]: RegisteredConvexFunction.register({ ...definitions["addMinutes"], handler: forward(definitions["addMinutes"].handler) }),
["allowDevice"]: RegisteredConvexFunction.register({ ...definitions["allowDevice"], handler: forward(definitions["allowDevice"].handler) }),
["changeToken"]: RegisteredConvexFunction.register({ ...definitions["changeToken"], handler: forward(definitions["changeToken"].handler) }),
["close"]: RegisteredConvexFunction.register({ ...definitions["close"], handler: forward(definitions["close"].handler) }),
["attempt"]: RegisteredConvexFunction.register({ ...definitions["attempt"], handler: forward(definitions["attempt"].handler) }),
["student"]: RegisteredConvexFunction.register({ ...definitions["student"], handler: forward(definitions["student"].handler) }),
["signals"]: RegisteredConvexFunction.register({ ...definitions["signals"], handler: forward(definitions["signals"].handler) }),
["paper"]: RegisteredConvexFunction.register({ ...definitions["paper"], handler: forward(definitions["paper"].handler) }),
["prompt"]: RegisteredConvexFunction.register({ ...definitions["prompt"], handler: forward(definitions["prompt"].handler) }),
["answer"]: RegisteredConvexFunction.register({ ...definitions["answer"], handler: forward(definitions["answer"].handler) }),
["finish"]: RegisteredConvexFunction.register({ ...definitions["finish"], handler: forward(definitions["finish"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../exams/sittings.spec")["default"]>;
