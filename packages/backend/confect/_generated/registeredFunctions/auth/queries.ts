import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../auth/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
