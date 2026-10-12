import { describe, expect, it } from "@effect/vitest";
import { labelsLearner } from "@repo/backend/confect/nina/memory/label";

describe("memory labels", () => {
  it.each([
    // The two sentences the capture saved on production on 12 October.
    "Learner berada di kelas 12 IPA.",
    "Learner lebih suka belajar dengan contoh soal terlebih dahulu sebelum rumus.",
    "Siswa kelas 12 IPA.",
    "Pengguna lebih suka contoh soal.",
    "Murid SMA di Bandung.",
    "The learner prefers worked examples.",
    "Student in grade 12.",
    "The user is preparing for the SNBT.",
    "Der Lernende ist in Klasse 12.",
    "Die Schülerin mag Beispielaufgaben.",
    "Nutzer lernt am liebsten mit Beispielen.",
  ])("labels a text that starts with a word for the learner: %j", (text) => {
    expect(labelsLearner(text, "")).toBe(true);
  });

  it.each([
    "  Learner berada di kelas 12.",
    "LEARNER berada di kelas 12.",
    "learner berada di kelas 12.",
  ])("reads a label in any case and after spaces: %j", (text) => {
    expect(labelsLearner(text, "")).toBe(true);
  });

  it("labels a start the learner said as well, because the fact reads without it", () => {
    expect(
      labelsLearner("Student in grade 12.", "i am a student in grade 12")
    ).toBe(true);
  });

  it.each([
    "Kelas 12 IPA.",
    "Lebih suka contoh soal dulu sebelum rumus.",
    "In grade 12.",
    "Prefers worked examples before formulas.",
    "Klasse 12, naturwissenschaftlicher Zweig.",
    "Lernt lieber erst mit Beispielaufgaben, dann mit der Formel.",
    "Ikut SNBT 2027.",
  ])("leaves a fact that says itself: %j", (text) => {
    expect(labelsLearner(text, "")).toBe(false);
  });

  it.each([
    "Pelajaran favorit: matematika.",
    "Studentenwerk Berlin ist die Mensa.",
    "Userland ist ihr Thema.",
    "Schülerzeitung als Hobby.",
  ])("leaves a text whose first word only starts like a label: %j", (text) => {
    expect(labelsLearner(text, "")).toBe(false);
  });

  it("labels an English word that the learner did not say, anywhere in the text", () => {
    expect(
      labelsLearner("Kelas 12 IPA, learner SMA.", "aku kelas 12 ipa")
    ).toBe(true);
    expect(
      labelsLearner(
        "Klasse 12, student der Mathematik.",
        "ich bin in klasse 12"
      )
    ).toBe(true);
  });

  it("leaves an English word in the middle that the learner said", () => {
    expect(
      labelsLearner("Language learner of German.", "i am a language learner")
    ).toBe(false);
  });
});
