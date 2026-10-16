import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import deletion from "../../../editor/deletion.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../editor/deletion.spec")["default"]>(databaseSchema, deletion, RegisteredConvexFunction.make);
