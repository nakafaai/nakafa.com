import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Semua jajanan anak sekolah tidak sehat karena terindikasi penyalahgunaan bahan berbahaya dan penggunaan bahan tambahan pangan yang melebihi batas maksimal yang diizinkan",
      value: false,
    },
    {
      label:
        "Tidak mengonsumsi jajanan yang tidak sehat atau tidak akan berdampak negatif pada anak-anak",
      value: false,
    },
    {
      label:
        "Menurut ketua IDAI, Dr.dr,Rini S,SpA(K), nutrisi utama hanya dapat dipenuhi dari jajanan anak",
      value: false,
    },
    { label: "Dampak kesehatan pasti terjadi pada saat dewasa", value: false },
    {
      label:
        "Makanan selingan termasuk jajanan anak bisa dijadikan sumber nutrisi",
      value: true,
    },
  ],
  en: [
    {
      label:
        "All school children's snacks are unhealthy because they indicate misuse of hazardous ingredients and use of food additives exceeding the maximum permitted limit",
      value: false,
    },
    {
      label:
        "Not consuming unhealthy snacks or it will not have a negative impact on children",
      value: false,
    },
    {
      label:
        "According to the chairman of IDAI, Dr.dr,Rini S,SpA(K), main nutrition can only be fulfilled from children's snacks",
      value: false,
    },
    {
      label: "Health impacts will definitely occur in adulthood",
      value: false,
    },
    {
      label:
        "Snacks including children's snacks can be used as a source of nutrition",
      value: true,
    },
  ],
};

export default choices;
