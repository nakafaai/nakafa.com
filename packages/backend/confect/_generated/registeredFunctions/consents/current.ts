import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import current from "../../../consents/current.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../consents/current.spec")["default"]>(databaseSchema, current, RegisteredConvexFunction.make);
