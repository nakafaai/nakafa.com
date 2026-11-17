import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/core.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/core.spec")["default"]>(databaseSchema, groupLayer);
