import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import uploads from "../../../../../classes/forums/mutations/uploads.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/mutations/uploads.spec")["default"]>(databaseSchema, uploads, RegisteredConvexFunction.make);
