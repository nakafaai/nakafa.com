import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import sealed from "../../../nina/sealed.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/sealed.spec")["default"]>(databaseSchema, sealed, RegisteredConvexFunction.make);
