import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import purge from "../../../bookmarks/purge.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../bookmarks/purge.spec")["default"]>(databaseSchema, purge, RegisteredConvexFunction.make);
