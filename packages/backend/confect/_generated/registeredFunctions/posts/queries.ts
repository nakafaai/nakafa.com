import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../posts/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../posts/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
