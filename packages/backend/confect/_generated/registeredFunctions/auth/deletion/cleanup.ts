import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../auth/deletion/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../auth/deletion/cleanup.spec")["default"]>(databaseSchema, groupLayer);
