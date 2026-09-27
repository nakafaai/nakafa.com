import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../onboarding/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../onboarding/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
