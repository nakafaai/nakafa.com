import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { Option, Schema } from "effect";

/** Parses one canonical Quran route segment through the signed number contract. */
export function parseQuranSurahNumber(value: unknown) {
  const decoded = Schema.decodeUnknownOption(QuranSurahNumberSchema)(
    Number(value)
  );
  if (Option.isNone(decoded) || decoded.value.toString() !== value) {
    return null;
  }

  return decoded.value;
}
