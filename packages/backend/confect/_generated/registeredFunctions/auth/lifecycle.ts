import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/lifecycle.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/lifecycle.spec")["default"]>(databaseSchema, groupLayer);
