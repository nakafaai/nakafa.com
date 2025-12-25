import { describe, expect, it } from "vitest";
import { isNumber, parseNumber } from "../number";

describe("isNumber", () => {
  describe("valid positive integers", () => {
    it("accepts single digit", () => {
      expect(isNumber("0")).toBe(true);
      expect(isNumber("5")).toBe(true);
    });

    it("accepts multiple digits", () => {
      expect(isNumber("123")).toBe(true);
      expect(isNumber("999999")).toBe(true);
    });

    it("accepts numbers with plus sign", () => {
      expect(isNumber("+123")).toBe(true);
      expect(isNumber("+0")).toBe(true);
    });
  });

  describe("valid negative integers", () => {
    it("accepts negative numbers", () => {
      expect(isNumber("-123")).toBe(true);
      expect(isNumber("-5")).toBe(true);
      expect(isNumber("-0")).toBe(true);
    });
  });

  describe("valid decimal numbers", () => {
    it("accepts positive decimals", () => {
      expect(isNumber("0.5")).toBe(true);
      expect(isNumber("12.34")).toBe(true);
      expect(isNumber("999.999")).toBe(true);
    });

    it("accepts negative decimals", () => {
      expect(isNumber("-0.5")).toBe(true);
      expect(isNumber("-12.34")).toBe(true);
      expect(isNumber("-999.999")).toBe(true);
    });

    it("accepts decimals starting with dot", () => {
      expect(isNumber(".5")).toBe(true);
      expect(isNumber(".123")).toBe(true);
    });

    it("rejects decimals ending with dot", () => {
      expect(isNumber("0.")).toBe(false);
      expect(isNumber("123.")).toBe(false);
    });
  });

  describe("valid edge cases", () => {
    it("accepts very small decimals", () => {
      expect(isNumber("0.001")).toBe(true);
      expect(isNumber("0.000001")).toBe(true);
    });

    it("accepts very large numbers", () => {
      expect(isNumber("999999999999999")).toBe(true);
    });
  });

  describe("empty and whitespace", () => {
    it("rejects empty string", () => {
      expect(isNumber("")).toBe(false);
    });

    it("rejects leading whitespace", () => {
      expect(isNumber(" 123")).toBe(false);
      expect(isNumber("\t123")).toBe(false);
      expect(isNumber("\n123")).toBe(false);
    });

    it("rejects trailing whitespace", () => {
      expect(isNumber("123 ")).toBe(false);
      expect(isNumber("123\t")).toBe(false);
      expect(isNumber("123\n")).toBe(false);
    });

    it("rejects surrounding whitespace", () => {
      expect(isNumber(" 123 ")).toBe(false);
      expect(isNumber("\t123\t")).toBe(false);
    });

    it("rejects whitespace only", () => {
      expect(isNumber(" ")).toBe(false);
      expect(isNumber("  ")).toBe(false);
      expect(isNumber("\t")).toBe(false);
      expect(isNumber("\n")).toBe(false);
    });
  });

  describe("invalid characters", () => {
    it("rejects letters", () => {
      expect(isNumber("abc")).toBe(false);
      expect(isNumber("123abc")).toBe(false);
      expect(isNumber("abc123")).toBe(false);
      expect(isNumber("12a3")).toBe(false);
    });

    it("rejects special characters", () => {
      expect(isNumber("12$")).toBe(false);
      expect(isNumber("$123")).toBe(false);
      expect(isNumber("12#34")).toBe(false);
      expect(isNumber("12@34")).toBe(false);
    });

    it("rejects commas", () => {
      expect(isNumber("1,234")).toBe(false);
      expect(isNumber("1,234.56")).toBe(false);
    });

    it("rejects underscores", () => {
      expect(isNumber("1_234")).toBe(false);
      expect(isNumber("123_456")).toBe(false);
    });
  });

  describe("multiple decimal points", () => {
    it("rejects multiple dots", () => {
      expect(isNumber("1.2.3")).toBe(false);
      expect(isNumber("1.2.3.4")).toBe(false);
      expect(isNumber("..")).toBe(false);
      expect(isNumber("...")).toBe(false);
    });
  });

  describe("multiple signs", () => {
    it("rejects multiple plus signs", () => {
      expect(isNumber("++123")).toBe(false);
      expect(isNumber("+++123")).toBe(false);
    });

    it("rejects multiple minus signs", () => {
      expect(isNumber("--123")).toBe(false);
      expect(isNumber("---123")).toBe(false);
    });

    it("rejects mixed signs", () => {
      expect(isNumber("+-123")).toBe(false);
      expect(isNumber("-+123")).toBe(false);
      expect(isNumber("+-")).toBe(false);
    });

    it("rejects sign at wrong position", () => {
      expect(isNumber("12+34")).toBe(false);
      expect(isNumber("12-34")).toBe(false);
      expect(isNumber("12.3+4")).toBe(false);
    });
  });

  describe("just signs or dots", () => {
    it("rejects just plus", () => {
      expect(isNumber("+")).toBe(false);
    });

    it("rejects just minus", () => {
      expect(isNumber("-")).toBe(false);
    });

    it("rejects just dot", () => {
      expect(isNumber(".")).toBe(false);
    });
  });

  describe("scientific notation", () => {
    it("rejects scientific notation with e", () => {
      expect(isNumber("1e5")).toBe(false);
      expect(isNumber("1E5")).toBe(false);
      expect(isNumber("1.5e-3")).toBe(false);
      expect(isNumber("1.5E3")).toBe(false);
    });
  });

  describe("non-decimal number systems", () => {
    it("rejects hexadecimal", () => {
      expect(isNumber("0x10")).toBe(false);
      expect(isNumber("0xFF")).toBe(false);
      expect(isNumber("0XFF")).toBe(false);
    });

    it("rejects octal", () => {
      expect(isNumber("0o77")).toBe(false);
      expect(isNumber("0O77")).toBe(false);
    });

    it("rejects binary", () => {
      expect(isNumber("0b101")).toBe(false);
      expect(isNumber("0B101")).toBe(false);
    });
  });

  describe("JavaScript special values", () => {
    it("rejects Infinity", () => {
      expect(isNumber("Infinity")).toBe(false);
      expect(isNumber("-Infinity")).toBe(false);
    });

    it("rejects NaN", () => {
      expect(isNumber("NaN")).toBe(false);
    });

    it("rejects undefined and null strings", () => {
      expect(isNumber("undefined")).toBe(false);
      expect(isNumber("null")).toBe(false);
    });
  });

  describe("boolean strings", () => {
    it("rejects true", () => {
      expect(isNumber("true")).toBe(false);
      expect(isNumber("TRUE")).toBe(false);
      expect(isNumber("True")).toBe(false);
    });

    it("rejects false", () => {
      expect(isNumber("false")).toBe(false);
      expect(isNumber("FALSE")).toBe(false);
      expect(isNumber("False")).toBe(false);
    });
  });

  describe("numbers with units or text", () => {
    it("rejects px units", () => {
      expect(isNumber("123px")).toBe(false);
      expect(isNumber("0.5px")).toBe(false);
    });

    it("rejects currency symbols", () => {
      expect(isNumber("$100")).toBe(false);
      expect(isNumber("€100")).toBe(false);
      expect(isNumber("£100")).toBe(false);
    });

    it("rejects percentages", () => {
      expect(isNumber("50%")).toBe(false);
      expect(isNumber("100%")).toBe(false);
    });
  });

  describe("zero with leading zeros", () => {
    it("accepts zero", () => {
      expect(isNumber("0")).toBe(true);
      expect(isNumber("0.0")).toBe(true);
    });

    it("accepts leading zeros on integers", () => {
      expect(isNumber("00123")).toBe(true);
      expect(isNumber("000123")).toBe(true);
      expect(isNumber("00")).toBe(true);
    });

    it("accepts leading zeros after sign", () => {
      expect(isNumber("+00123")).toBe(true);
      expect(isNumber("-00123")).toBe(true);
    });
  });

  describe("empty after sign", () => {
    it("rejects plus with nothing after", () => {
      expect(isNumber("+")).toBe(false);
      expect(isNumber("+ ")).toBe(false);
    });

    it("rejects minus with nothing after", () => {
      expect(isNumber("-")).toBe(false);
      expect(isNumber("- ")).toBe(false);
    });
  });

  describe("special unicode", () => {
    it("rejects arabic numerals", () => {
      expect(isNumber("١٢٣")).toBe(false);
    });

    it("rejects other unicode digits", () => {
      expect(isNumber("１２３")).toBe(false);
      expect(isNumber("𝟏𝟐𝟑")).toBe(false);
    });
  });

  describe("invalid decimal positions", () => {
    it("rejects dot at start with nothing after", () => {
      expect(isNumber(".")).toBe(false);
    });

    it("rejects dot with sign only", () => {
      expect(isNumber("+.")).toBe(false);
      expect(isNumber("-.")).toBe(false);
    });
  });

  describe("mixed case", () => {
    it("rejects mixed alphanumeric", () => {
      expect(isNumber("a1b2c3")).toBe(false);
      expect(isNumber("1a2b3c")).toBe(false);
    });
  });

  describe("quotes and backticks", () => {
    it("rejects single quotes", () => {
      expect(isNumber("'123'")).toBe(false);
      expect(isNumber("'")).toBe(false);
    });

    it("rejects double quotes", () => {
      expect(isNumber('"123"')).toBe(false);
      expect(isNumber('"')).toBe(false);
    });

    it("rejects backticks", () => {
      expect(isNumber("`123`")).toBe(false);
      expect(isNumber("`")).toBe(false);
    });
  });

  describe("operators and expressions", () => {
    it("rejects arithmetic expressions", () => {
      expect(isNumber("1+2")).toBe(false);
      expect(isNumber("1-2")).toBe(false);
      expect(isNumber("1*2")).toBe(false);
      expect(isNumber("1/2")).toBe(false);
    });

    it("rejects comparison operators", () => {
      expect(isNumber("1>2")).toBe(false);
      expect(isNumber("1<2")).toBe(false);
      expect(isNumber("1==2")).toBe(false);
      expect(isNumber("1!=2")).toBe(false);
    });
  });

  describe("path and url characters", () => {
    it("rejects path separators", () => {
      expect(isNumber("123/456")).toBe(false);
      expect(isNumber("123\\456")).toBe(false);
    });

    it("rejects url characters", () => {
      expect(isNumber("123?456")).toBe(false);
      expect(isNumber("123&456")).toBe(false);
      expect(isNumber("123=456")).toBe(false);
    });
  });

  describe("brackets and braces", () => {
    it("rejects parentheses", () => {
      expect(isNumber("(123)")).toBe(false);
      expect(isNumber("(1)")).toBe(false);
      expect(isNumber(")123(")).toBe(false);
    });

    it("rejects square brackets", () => {
      expect(isNumber("[123]")).toBe(false);
      expect(isNumber("[1]")).toBe(false);
    });

    it("rejects curly braces", () => {
      expect(isNumber("{123}")).toBe(false);
      expect(isNumber("{1}")).toBe(false);
    });
  });

  describe("emoji and symbols", () => {
    it("rejects emojis with numbers", () => {
      expect(isNumber("123💯")).toBe(false);
      expect(isNumber("💯123")).toBe(false);
      expect(isNumber("1💯2")).toBe(false);
    });

    it("rejects math symbols", () => {
      expect(isNumber("π123")).toBe(false);
      expect(isNumber("123π")).toBe(false);
    });
  });

  describe("phone number formats", () => {
    it("rejects phone number with dashes", () => {
      expect(isNumber("123-456-7890")).toBe(false);
    });

    it("rejects phone number with spaces", () => {
      expect(isNumber("123 456 7890")).toBe(false);
    });

    it("rejects phone number with parentheses", () => {
      expect(isNumber("(123) 456-7890")).toBe(false);
    });

    it("rejects phone number with plus and spaces", () => {
      expect(isNumber("+1 234 567 890")).toBe(false);
    });
  });

  describe("social security and ID numbers", () => {
    it("rejects SSN format with dashes", () => {
      expect(isNumber("123-45-6789")).toBe(false);
    });

    it("rejects ID format with letters", () => {
      expect(isNumber("A12345678")).toBe(false);
      expect(isNumber("12345678B")).toBe(false);
    });
  });

  describe("time and date formats", () => {
    it("rejects time format with colons", () => {
      expect(isNumber("12:34")).toBe(false);
      expect(isNumber("12:34:56")).toBe(false);
    });

    it("rejects date format with slashes", () => {
      expect(isNumber("12/31/2024")).toBe(false);
      expect(isNumber("2024/12/31")).toBe(false);
    });

    it("rejects date format with dashes", () => {
      expect(isNumber("2024-12-31")).toBe(false);
      expect(isNumber("31-12-2024")).toBe(false);
    });
  });

  describe("ip addresses", () => {
    it("rejects IPv4 format", () => {
      expect(isNumber("192.168.1.1")).toBe(false);
      expect(isNumber("127.0.0.1")).toBe(false);
    });

    it("rejects IPv6 format", () => {
      expect(isNumber("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(false);
    });
  });

  describe("coordinate formats", () => {
    it("rejects degrees format", () => {
      expect(isNumber("90.123°N")).toBe(false);
      expect(isNumber("180.456°W")).toBe(false);
    });

    it("rejects coordinate format with symbols", () => {
      expect(isNumber("90.123, -180.456")).toBe(false);
      expect(isNumber("90°12'34\"N")).toBe(false);
    });
  });

  describe("fraction formats", () => {
    it("rejects simple fractions", () => {
      expect(isNumber("1/2")).toBe(false);
      expect(isNumber("3/4")).toBe(false);
    });

    it("rejects mixed numbers", () => {
      expect(isNumber("1 1/2")).toBe(false);
      expect(isNumber("3 3/4")).toBe(false);
    });

    it("rejects unicode fractions", () => {
      expect(isNumber("½")).toBe(false);
      expect(isNumber("¾")).toBe(false);
    });
  });

  describe("percentage variations", () => {
    it("rejects percentages with decimals", () => {
      expect(isNumber("50.5%")).toBe(false);
      expect(isNumber("99.99%")).toBe(false);
    });

    it("rejects per mille", () => {
      expect(isNumber("50‰")).toBe(false);
      expect(isNumber("100‰")).toBe(false);
    });

    it("rejects basis points", () => {
      expect(isNumber("50‱")).toBe(false);
      expect(isNumber("100‱")).toBe(false);
    });
  });

  describe("currency with decimals", () => {
    it("rejects euro format with comma", () => {
      expect(isNumber("123,45")).toBe(false);
      expect(isNumber("1.234,56")).toBe(false);
    });

    it("rejects Indian numbering", () => {
      expect(isNumber("1,23,456.78")).toBe(false);
    });
  });

  describe("binary data representations", () => {
    it("accepts binary-like strings as valid numbers", () => {
      expect(isNumber("01010101")).toBe(true);
      expect(isNumber("11111111")).toBe(true);
    });

    it("rejects hex without prefix", () => {
      expect(isNumber("FF")).toBe(false);
      expect(isNumber("ABCDEF")).toBe(false);
    });
  });

  describe("version numbers", () => {
    it("rejects semantic versioning", () => {
      expect(isNumber("1.0.0")).toBe(false);
      expect(isNumber("2.5.3")).toBe(false);
      expect(isNumber("1.2.3-beta")).toBe(false);
    });

    it("accepts calendar versioning as valid numbers", () => {
      expect(isNumber("2024.01")).toBe(true);
      expect(isNumber("24.12")).toBe(true);
    });
  });

  describe("measurement units", () => {
    it("rejects metric prefixes", () => {
      expect(isNumber("1k")).toBe(false);
      expect(isNumber("1M")).toBe(false);
      expect(isNumber("1G")).toBe(false);
    });

    it("rejects binary prefixes", () => {
      expect(isNumber("1Ki")).toBe(false);
      expect(isNumber("1Mi")).toBe(false);
      expect(isNumber("1Gi")).toBe(false);
    });
  });

  describe("temperature formats", () => {
    it("rejects celsius", () => {
      expect(isNumber("25°C")).toBe(false);
      expect(isNumber("100°C")).toBe(false);
    });

    it("rejects fahrenheit", () => {
      expect(isNumber("77°F")).toBe(false);
      expect(isNumber("212°F")).toBe(false);
    });

    it("rejects kelvin", () => {
      expect(isNumber("298K")).toBe(false);
      expect(isNumber("373K")).toBe(false);
    });
  });

  describe("unicode whitespace variants", () => {
    it("rejects non-breaking space", () => {
      expect(isNumber("123\u00A0")).toBe(false);
      expect(isNumber("\u00A0123")).toBe(false);
    });

    it("rejects zero-width spaces", () => {
      expect(isNumber("1\u200B23")).toBe(false);
      expect(isNumber("\u200B123")).toBe(false);
    });

    it("rejects thin spaces", () => {
      expect(isNumber("1\u200923")).toBe(false);
      expect(isNumber("123\u2009")).toBe(false);
    });
  });

  describe("escape sequences", () => {
    it("rejects escape characters", () => {
      expect(isNumber("\\n123")).toBe(false);
      expect(isNumber("123\\t")).toBe(false);
      expect(isNumber("\\r123\\n")).toBe(false);
    });

    it("rejects backslashes", () => {
      expect(isNumber("\\123")).toBe(false);
      expect(isNumber("123\\")).toBe(false);
      expect(isNumber("\\\\123\\\\")).toBe(false);
    });
  });
});

describe("parseNumber", () => {
  describe("returns correct number values", () => {
    it("parses positive integers", () => {
      expect(parseNumber("123")).toBe(123);
      expect(parseNumber("0")).toBe(0);
    });

    it("parses negative integers", () => {
      expect(parseNumber("-123")).toBe(-123);
      expect(parseNumber("-0")).toBe(-0);
    });

    it("parses positive decimals", () => {
      expect(parseNumber("12.34")).toBe(12.34);
      expect(parseNumber("0.5")).toBe(0.5);
    });

    it("parses negative decimals", () => {
      expect(parseNumber("-12.34")).toBe(-12.34);
      expect(parseNumber("-0.5")).toBe(-0.5);
    });

    it("parses numbers with plus sign", () => {
      expect(parseNumber("+123")).toBe(123);
      expect(parseNumber("+0.5")).toBe(0.5);
    });

    it("parses decimals starting with dot", () => {
      expect(parseNumber(".5")).toBe(0.5);
      expect(parseNumber(".123")).toBe(0.123);
    });
  });

  describe("returns null for invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(parseNumber("")).toBeNull();
    });

    it("returns null for strings with whitespace", () => {
      expect(parseNumber(" 123")).toBeNull();
      expect(parseNumber("123 ")).toBeNull();
      expect(parseNumber(" 123 ")).toBeNull();
    });

    it("returns null for non-numeric strings", () => {
      expect(parseNumber("abc")).toBeNull();
      expect(parseNumber("12a")).toBeNull();
      expect(parseNumber("12.3.4")).toBeNull();
    });

    it("returns null for special numeric strings", () => {
      expect(parseNumber("Infinity")).toBeNull();
      expect(parseNumber("NaN")).toBeNull();
      expect(parseNumber("1e5")).toBeNull();
    });
  });

  describe("handles edge cases", () => {
    it("handles very large numbers", () => {
      expect(parseNumber("999999999999999")).toBe(999_999_999_999_999);
    });

    it("handles very small decimals", () => {
      expect(parseNumber("0.000001")).toBe(0.000_001);
    });

    it("handles zero variations", () => {
      expect(parseNumber("0")).toBe(0);
      expect(parseNumber("0.0")).toBe(0);
      expect(parseNumber("+0")).toBe(0);
      expect(parseNumber("-0")).toBe(-0);
    });
  });
});
