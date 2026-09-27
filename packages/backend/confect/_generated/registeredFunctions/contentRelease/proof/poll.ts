import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import poll from "../../../../contentRelease/proof/poll.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/proof/poll.spec")["default"]>(databaseSchema, poll, RegisteredConvexFunction.make);
