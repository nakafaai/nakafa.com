import { isSafePedagogyMarkdown } from "@repo/ai/nina/pedagogy/schema";
import { describe, expect, it } from "vitest";

describe("isSafePedagogyMarkdown", () => {
  it.each([
    "Syarat soal membuat hanya jawaban positif yang perlu kamu perhatikan.",
    "Faktorkan $x^2 - 4$ lalu gunakan syarat $x \\ge 0$.",
    "**Syaratnya:** pilih nilai $x=2$ karena batasnya sudah ditentukan.",
    "Bentuk hasilnya adalah \\[(x - 2)(x + 2)\\].",
  ])("accepts learner Markdown or LaTeX %#", (text) => {
    expect(isSafePedagogyMarkdown(text)).toBe(true);
  });

  it.each([
    "",
    "# Langkah penyelesaian",
    "- Terapkan syarat soal",
    "Hasil akhirnya adalah x^2 - 4.",
    "Hasil akhirnya adalah x = 2.",
    "Hasil CAS adalah Eq(x**2, 4).",
    "Faktorkan (x - 2)*(x + 2).",
    "Gunakan x >= 0.",
    "```math\nx = 2\n```",
    "Solusi tersebut telah diverifikasi kebenarannya melalui perhitungan sistem.",
    "Sudah dicek dengan perhitungan eksak.",
  ])("rejects unsafe live narration text %#", (text) => {
    expect(isSafePedagogyMarkdown(text)).toBe(false);
  });
});
