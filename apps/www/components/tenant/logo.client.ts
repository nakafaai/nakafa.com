import {
  LOGO_BYTE_LIMIT,
  type LogoAnswer,
  LogoType,
} from "@repo/backend/confect/tenancy/schema";
import { Match, Schema } from "effect";

/**
 * Why a chosen file cannot be the school's logo: its type is not a PNG or an SVG
 * image, or it holds more than the logo limit. The page checks both before it asks
 * for an upload address, so a refused file is never uploaded.
 */
export function logoRefusalOf(file: {
  readonly size: number;
  readonly type: string;
}): "size" | "type" | undefined {
  if (!Schema.is(LogoType)(file.type)) {
    return "type";
  }
  if (file.size > LOGO_BYTE_LIMIT) {
    return "size";
  }
  return undefined;
}

/** What the page shows for the answer of `set`: a saved logo, or a file the server refused. */
export const logoAnswerOutcome = (answer: typeof LogoAnswer.Type) =>
  Match.valueTags(answer, {
    LogoRefused: (): "refused" => "refused",
    LogoSet: (): "saved" => "saved",
  });
