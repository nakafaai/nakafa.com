import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import catalog from "../../../../tryouts/queries/catalog.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/catalog.spec")["default"]>(databaseSchema, catalog, RegisteredConvexFunction.make);
