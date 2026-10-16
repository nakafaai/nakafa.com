import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import people from "../../../tenancy/people.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/people.spec")["default"]>(databaseSchema, people, RegisteredConvexFunction.make);
