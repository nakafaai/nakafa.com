import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import backfill from "../../../../contentRelease/artifact/backfill.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/artifact/backfill.spec")["default"]>(databaseSchema, backfill, RegisteredConvexFunction.make);
