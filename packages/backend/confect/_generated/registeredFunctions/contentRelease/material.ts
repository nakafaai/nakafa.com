import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import material from "../../../contentRelease/material.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/material.spec")["default"]>(databaseSchema, material, RegisteredConvexFunction.make);
