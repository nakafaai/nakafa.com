import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import admission from "../../../../customers/checkout/admission.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/checkout/admission.spec")["default"]>(databaseSchema, admission, RegisteredConvexFunction.make);
