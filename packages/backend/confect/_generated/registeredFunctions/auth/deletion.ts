import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import deletion from "../../../auth/deletion.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/deletion.spec")["default"]>(databaseSchema, deletion, RegisteredConvexFunction.make);
