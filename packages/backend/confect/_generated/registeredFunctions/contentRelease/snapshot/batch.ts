import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import batch from "../../../../contentRelease/snapshot/batch.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/snapshot/batch.spec")["default"]>(databaseSchema, batch, RegisteredConvexFunction.make);
