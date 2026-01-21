import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "Persentase kenaikan tertinggi dialami oleh perusahaan B",
      value: false,
    },
    {
      label:
        "Jumlah pengguna smartphone di setiap perusahaan bersifat fluktuatif",
      value: false,
    },
    {
      label: "Persentase penurunan terbesar terjadi di Perusahaan B",
      value: false,
    },
    {
      label:
        "Jumlah pengguna smartphone terendah adalah smartphone dari Perusahaan C",
      value: true,
    },
    {
      label:
        "Jumlah pengguna smartphone tertinggi adalah smartphone dari Perusahaan B",
      value: false,
    },
  ],
  en: [
    {
      label: "The highest percentage increase was experienced by company B",
      value: false,
    },
    {
      label: "The number of smartphone users in every company is fluctuating",
      value: false,
    },
    {
      label: "The largest percentage decrease occurred in Company B",
      value: false,
    },
    {
      label: "The lowest number of smartphone users is from Company C",
      value: true,
    },
    {
      label: "The highest number of smartphone users is from Company B",
      value: false,
    },
  ],
};

export default choices;
