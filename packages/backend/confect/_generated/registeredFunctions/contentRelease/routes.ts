import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import routes from "../../../contentRelease/routes.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/routes.spec")["default"]>(databaseSchema, routes, RegisteredConvexFunction.make);
