import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Kodrat tubuh manusia membutuhkan pangan utuh, bukan produk proses apalagi rafinasi.",
      value: false,
    },
    {
      label:
        "Telur selalu bisa jadi andalan untuk bahan sarapan yang praktis dan lezat.",
      value: false,
    },
    {
      label:
        "Selain itu harga telur juga cukup terjangkau dan mudah didapat di mana saja.",
      value: false,
    },
    {
      label:
        "Jika dibandingkan dengan makanan berprotein tinggi lainnya, seperti daging, telur adalah sumber protein yang relatif terjangkau.",
      value: true,
    },
    {
      label:
        "Satu butir telur utuh mengandung protein lengkap, artinya telur mengandung semua asam amino esensial yang diperlukan oleh tubuh.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "Human body nature requires whole foods, not processed let alone refined products.",
      value: false,
    },
    {
      label:
        "Eggs can always be relied on for a practical and delicious breakfast ingredient.",
      value: false,
    },
    {
      label:
        "Besides that, the price of eggs is also quite affordable and easy to get anywhere.",
      value: false,
    },
    {
      label:
        "When compared to other high-protein foods, such as meat, eggs are a relatively affordable source of protein.",
      value: true,
    },
    {
      label:
        "One whole egg contains complete protein, meaning the egg contains all the essential amino acids needed by the body.",
      value: false,
    },
  ],
};

export default choices;
