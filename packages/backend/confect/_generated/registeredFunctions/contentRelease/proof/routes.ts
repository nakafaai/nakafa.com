import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import routes from "../../../../contentRelease/proof/routes.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/proof/routes.spec")["default"]>(databaseSchema, routes, RegisteredConvexFunction.make);
