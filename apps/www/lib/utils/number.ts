import * as z from "zod";

export function isNumber(value: string): boolean {
  return z.coerce.number().safeParse(value).success;
}
