import {
  createGoogleUsernameFields,
  usernameOptions,
} from "@repo/backend/convex/auth/username/policy";
import { describe, expect, it } from "vitest";

describe("auth/username policy", () => {
  it("creates a valid Better Auth username from a Google profile", () => {
    const fields = createGoogleUsernameFields({
      email: "Person.Name+school@gmail.com",
      sub: "109876543210123456789",
    });

    expect(fields).toEqual({
      username: "g_person.name_n6sgfvtg7cyl1",
      displayUsername: "person.name",
    });
    expect(usernameOptions.usernameValidator(fields.username)).toBe(true);
    expect(fields.username).toHaveLength(27);
  });

  it("keeps usernames within Better Auth's default length limit", () => {
    const fields = createGoogleUsernameFields({
      email: "very.long.email.local.part@gmail.com",
      sub: "109876543210123456789",
    });

    expect(fields.username).toBe("g_very.long.emai_n6sgfvtg7cyl1");
    expect(fields.username).toHaveLength(30);
    expect(usernameOptions.usernameValidator(fields.username)).toBe(true);
  });

  it("falls back to a readable base when the email local part is too short", () => {
    const fields = createGoogleUsernameFields({
      email: "a@gmail.com",
      sub: "12345",
    });

    expect(fields.username).toBe("g_user_9ix");
  });

  it("falls back to a safe suffix when the Google subject is missing", () => {
    const fields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "",
    });

    expect(fields.username).toBe("g_student_0");
  });

  it("normalizes unsupported username characters", () => {
    const fields = createGoogleUsernameFields({
      email: "Nabila-Fatih!@example.com",
      sub: "abcde12345",
    });

    expect(fields.username).toBe("g_nabila_fatih_abcde12345");
    expect(usernameOptions.usernameValidator(fields.username)).toBe(true);
  });

  it("uses Google subject suffixes to avoid common email-local collisions", () => {
    const firstFields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "111111111111111111111",
    });
    const secondFields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "222222222222222222222",
    });

    expect(firstFields.username).toBe("g_student_ng64hohj4t2h3");
    expect(secondFields.username).toBe("g_student_1awc8zcz29m4y6");
  });

  it("keeps the full numeric Google subject in the encoded suffix", () => {
    const firstFields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "100000000000000000001",
    });
    const secondFields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "200000000000000000001",
    });

    expect(firstFields.username).toBe("g_student_l3r41ifs0q5tt");
    expect(secondFields.username).toBe("g_student_167i830vk1gbnl");
  });

  it("handles emails without an at sign", () => {
    const fields = createGoogleUsernameFields({
      email: "local-only",
      sub: "abcde12345",
    });

    expect(fields.username).toBe("g_local_only_abcde12345");
  });

  it("trims punctuation introduced by the username length limit", () => {
    const fields = createGoogleUsernameFields({
      email: "abcdefghijklmnopqr.stu@example.com",
      sub: "abcde12345",
    });

    expect(fields.username).toBe("g_abcdefghijklmnopq_abcde12345");
  });

  it("limits long nonnumeric subjects and keeps the username valid", () => {
    const fields = createGoogleUsernameFields({
      email: "ab.username@example.com",
      sub: "subjectabcdefghijklmnopqrstuvwxyz",
    });

    expect(fields.username).toBe("g_ab.username_1s4erl46ep2y6");
    expect(fields.username).toHaveLength(27);
    expect(usernameOptions.usernameValidator(fields.username)).toBe(true);
  });
});
