import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Shanti menegaskan bahwa anak-anak di bawah usia 12 tahun tetap boleh menggunakan gawai, tetapi penggunaannya harus didampingi oleh orang tua.",
      value: true,
    },
    {
      label:
        "Shanti menegaskan bahwa anak-anak di bawah usia 12 tahun tetap boleh menggunakan gawai, akan tetapi penggunaannya harus didampingi dari orang tua.",
      value: false,
    },
    {
      label:
        "Shanti menegaskan anak-anak di bawah usia 12 tahun tetap boleh menggunakan gawai dan penggunaannya harus didampingi dari orang tua.",
      value: false,
    },
    {
      label:
        "Shanti menegaskan anak-anak di bawah usia 12 tahun tetap boleh menggunakan gawai, meskipun penggunaannya harus didampingi oleh orang tua.",
      value: false,
    },
    {
      label:
        "Shanti menegaskan anak-anak di bawah usia 12 tahun tetap boleh menggunakan gawai, asalkan, penggunaannya harus didampingi dari orang tua.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Shanti emphasized that children under the age of 12 are still allowed to use gadgets, but their use must be accompanied by parents.",
      value: true,
    },
    {
      label:
        "Shanti emphasized that children under the age of 12 are still allowed to use gadgets, however their use must be accompanied from parents.",
      value: false,
    },
    {
      label:
        "Shanti emphasized children under the age of 12 are still allowed to use gadgets and their use must be accompanied from parents.",
      value: false,
    },
    {
      label:
        "Shanti emphasized children under the age of 12 are still allowed to use gadgets, although their use must be accompanied by parents.",
      value: false,
    },
    {
      label:
        "Shanti emphasized children under the age of 12 are still allowed to use gadgets, provided that, their use must be accompanied from parents.",
      value: false,
    },
  ],
};

export default choices;
