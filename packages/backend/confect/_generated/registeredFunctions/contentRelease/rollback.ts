import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import rollback from "../../../contentRelease/rollback.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/rollback.spec")["default"]>(databaseSchema, rollback, RegisteredConvexFunction.make);
