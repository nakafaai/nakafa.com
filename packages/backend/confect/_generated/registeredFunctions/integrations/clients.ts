import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import clients from "../../../integrations/clients.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../integrations/clients.spec")["default"]>(databaseSchema, clients, RegisteredConvexFunction.make);
