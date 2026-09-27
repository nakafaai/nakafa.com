import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import quran from "../../../contentRelease/quran.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/quran.spec")["default"]>(databaseSchema, quran, RegisteredConvexFunction.make);
