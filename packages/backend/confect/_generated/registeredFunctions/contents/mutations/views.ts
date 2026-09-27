import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import views from "../../../../contents/mutations/views.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/mutations/views.spec")["default"]>(databaseSchema, views, RegisteredConvexFunction.make);
