import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import responses from "../../../../tryouts/mutations/responses.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/mutations/responses.spec")["default"]>(databaseSchema, responses, RegisteredConvexFunction.make);
