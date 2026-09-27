import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import catalog from "../../../../contentRelease/proof/catalog.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/proof/catalog.spec")["default"]>(databaseSchema, catalog, RegisteredConvexFunction.make);
