import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import visits from "../../../operators/visits.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../operators/visits.spec")["default"]>(databaseSchema, visits, RegisteredConvexFunction.make);
