import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import pages from "../../../../../classes/forums/queries/pages.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/queries/pages.spec")["default"]>(databaseSchema, pages, RegisteredConvexFunction.make);
