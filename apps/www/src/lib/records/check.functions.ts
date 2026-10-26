import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { CheckInput } from "@/lib/records/check";

/** The public check of a report card's hash, which the check page's loader calls. */
export const checkReportFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CheckInput))
  .handler(async (options) => {
    const { checkReportHandler } = await import("@/lib/records/check.server");
    return checkReportHandler(options);
  });
