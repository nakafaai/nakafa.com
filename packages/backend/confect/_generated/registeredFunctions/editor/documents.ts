import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import documents from "../../../editor/documents.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../editor/documents.spec")["default"]>(databaseSchema, documents, RegisteredConvexFunction.make);
