import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../auth/actions.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/actions.spec")["default"]>(databaseSchema, groupLayer);
