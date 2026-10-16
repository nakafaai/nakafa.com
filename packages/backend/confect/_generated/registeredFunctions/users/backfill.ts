import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import backfill from "../../../users/backfill.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../users/backfill.spec")["default"]>(databaseSchema, backfill, RegisteredConvexFunction.make);
