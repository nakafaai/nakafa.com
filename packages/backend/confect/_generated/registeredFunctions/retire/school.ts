import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import school from "../../../retire/school.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../retire/school.spec")["default"]>(databaseSchema, school, RegisteredConvexFunction.make);
