import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../customers/deletion/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/deletion/cleanup.spec")["default"]>(databaseSchema, groupLayer);
