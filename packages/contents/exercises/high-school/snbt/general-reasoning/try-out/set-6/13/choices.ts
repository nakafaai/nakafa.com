import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Terdapat beberapa negara yang melakukan retaliasi dengan cara menyulitkan ekspor asal Indonesia masuk ke negara-negara bersangkutan.",
      value: false,
    },
    {
      label:
        "Peternak ayam merugi karena harga ayam di pasaran ambruk yang disebabkan oleh kekalahan Indonesia terhadap Brasil.",
      value: false,
    },
    {
      label:
        "Kinerja neraca perdagangan ditentukan oleh retaliasi terhadap ekspor yang menyulitkan ekspor asal Indonesia ke beberapa negara.",
      value: false,
    },
    {
      label:
        "Retaliasi yang dilakukan oleh beberapa negara terhadap Indonesia memengaruhi kinerja neraca perdagangan Indonesia.",
      value: false,
    },
    {
      label: "Para peternak ayam mandiri mengalami kerugian.",
      value: true,
    },
  ],
  en: [
    {
      label:
        "There are several countries that retaliate by complicating the entry of exports from Indonesia into the countries concerned.",
      value: false,
    },
    {
      label:
        "Chicken farmers lost money because chicken prices in the market collapsed caused by Indonesia's defeat against Brazil.",
      value: false,
    },
    {
      label:
        "Trade balance performance is determined by retaliation against exports which complicates exports from Indonesia to several countries.",
      value: false,
    },
    {
      label:
        "Retaliation carried out by several countries against Indonesia affects Indonesia's trade balance performance.",
      value: false,
    },
    {
      label: "Independent chicken farmers experienced losses.",
      value: true,
    },
  ],
};

export default choices;
