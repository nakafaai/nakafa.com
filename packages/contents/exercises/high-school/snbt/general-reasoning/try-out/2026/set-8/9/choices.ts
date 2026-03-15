import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Mahasiswa yang tidak meraih nilai ujian tinggi berarti tidak dapat mengatur waktunya dengan baik",
      value: true,
    },
    {
      label:
        "Mahasiswa tidak meraih nilai ujian tinggi jika dapat mengatur waktunya dengan baik",
      value: false,
    },
    {
      label:
        "Mahasiswa dapat meraih nilai ujian tinggi jika tidak dapat mengatur waktunya dengan baik",
      value: false,
    },
    {
      label:
        "Mahasiswa dapat mengatur waktunya dengan baik jika dapat meraih nilai ujian tinggi",
      value: false,
    },
    {
      label:
        "Mahasiswa yang tidak mengatur waktunya dengan baik akan dapat meraih nilai ujian tinggi",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Students who do not achieve high exam scores mean they cannot manage their time well",
      value: true,
    },
    {
      label:
        "Students do not achieve high exam scores if they can manage their time well",
      value: false,
    },
    {
      label:
        "Students can achieve high exam scores if they cannot manage their time well",
      value: false,
    },
    {
      label:
        "Students can manage their time well if they can achieve high exam scores",
      value: false,
    },
    {
      label:
        "Students who do not manage their time well will be able to achieve high exam scores",
      value: false,
    },
  ],
};

export default choices;
