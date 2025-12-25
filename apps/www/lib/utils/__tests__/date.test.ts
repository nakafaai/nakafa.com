import { describe, expect, it } from "vitest";
import { getLocale } from "../date";

describe("getLocale", () => {
  describe("supported locales", () => {
    it("returns enUS locale for 'en'", () => {
      const locale = getLocale("en");
      expect(locale.code).toBe("en-US");
    });

    it("returns id locale for 'id'", () => {
      const locale = getLocale("id");
      expect(locale.code).toBe("id");
    });
  });

  describe("case handling", () => {
    it("returns enUS for uppercase 'EN'", () => {
      const locale = getLocale("EN" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("returns enUS for mixed case 'En'", () => {
      const locale = getLocale("En" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("returns enUS for uppercase 'ID'", () => {
      const locale = getLocale("ID" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("returns enUS for mixed case 'Id'", () => {
      const locale = getLocale("Id" as "en");
      expect(locale.code).toBe("en-US");
    });
  });

  describe("unsupported locales", () => {
    it("defaults to enUS for 'fr'", () => {
      const locale = getLocale("fr" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'de'", () => {
      const locale = getLocale("de" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'es'", () => {
      const locale = getLocale("es" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'zh'", () => {
      const locale = getLocale("zh" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'ja'", () => {
      const locale = getLocale("ja" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'ko'", () => {
      const locale = getLocale("ko" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'ru'", () => {
      const locale = getLocale("ru" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'ar'", () => {
      const locale = getLocale("ar" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'hi'", () => {
      const locale = getLocale("hi" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'pt'", () => {
      const locale = getLocale("pt" as "en");
      expect(locale.code).toBe("en-US");
    });
  });

  describe("empty and undefined values", () => {
    it("defaults to enUS for undefined", () => {
      const locale = getLocale(undefined as unknown as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for null", () => {
      const locale = getLocale(null as unknown as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for empty string", () => {
      const locale = getLocale("" as "en");
      expect(locale.code).toBe("en-US");
    });
  });

  describe("locale codes with region", () => {
    it("defaults to enUS for 'en-GB'", () => {
      const locale = getLocale("en-GB" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'en-AU'", () => {
      const locale = getLocale("en-AU" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for 'id-ID'", () => {
      const locale = getLocale("id-ID" as "en");
      expect(locale.code).toBe("en-US");
    });
  });

  describe("invalid locale formats", () => {
    it("defaults to enUS for numbers", () => {
      const locale = getLocale("123" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for special characters", () => {
      const locale = getLocale("@#$%" as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for very long string", () => {
      const locale = getLocale("verylongstringthatisnotalocale" as "en");
      expect(locale.code).toBe("en-US");
    });
  });

  describe("whitespace handling", () => {
    it("defaults to enUS for spaces", () => {
      const locale = getLocale("   " as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for whitespace with locale", () => {
      const locale = getLocale("  en  " as "en");
      expect(locale.code).toBe("en-US");
    });

    it("defaults to enUS for tabs and newlines", () => {
      const locale = getLocale("\t\n" as "en");
      expect(locale.code).toBe("en-US");
    });
  });

  describe("locale object compatibility", () => {
    it("handles locale as string type", () => {
      const locale = getLocale("en");
      expect(locale).toBeDefined();
      expect(locale).toHaveProperty("code");
    });

    it("returns locale object with required properties", () => {
      const locale = getLocale("id");
      expect(locale).toHaveProperty("code");
    });
  });

  describe("locale consistency", () => {
    it("returns same locale for repeated calls", () => {
      const locale1 = getLocale("en");
      const locale2 = getLocale("en");
      expect(locale1.code).toBe(locale2.code);
    });

    it("returns same locale for different case of same locale", () => {
      const locale1 = getLocale("en");
      const locale2 = getLocale("EN" as "en");
      expect(locale1.code).toBe(locale2.code);
    });
  });
});
