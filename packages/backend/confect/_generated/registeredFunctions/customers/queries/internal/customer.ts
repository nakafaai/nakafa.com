import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import customer from "../../../../../customers/queries/internal/customer.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../customers/queries/internal/customer.spec")["default"]>(databaseSchema, customer, RegisteredConvexFunction.make);
