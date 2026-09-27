import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import models from "../../../contentRelease/models.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/models.spec")["default"]>(databaseSchema, models, RegisteredConvexFunction.make);
