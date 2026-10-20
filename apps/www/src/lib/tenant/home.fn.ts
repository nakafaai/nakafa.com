import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  StaffHomeInput,
  StudentHomeInput,
  staffHomeHandler,
  studentHomeHandler,
} from "@/lib/tenant/home.server";

/** The first screen of a staff home, which the school home's loader calls on the server and in the browser. */
export const readStaffHomeFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(StaffHomeInput))
  .handler(staffHomeHandler);

/** The first screen of a student home, which the school home's loader calls on the server and in the browser. */
export const readStudentHomeFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(StudentHomeInput))
  .handler(studentHomeHandler);
