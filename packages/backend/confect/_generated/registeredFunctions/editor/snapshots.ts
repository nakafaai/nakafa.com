import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import snapshots from "../../../editor/snapshots.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../editor/snapshots.spec")["default"]>(databaseSchema, snapshots, RegisteredConvexFunction.make);
