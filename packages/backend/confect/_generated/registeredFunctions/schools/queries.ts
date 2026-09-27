import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../schools/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../schools/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
