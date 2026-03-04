import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Kelelawar terbang untuk berburu serangga dan hewan lainnya pada siang hari.",
      value: false,
    },
    {
      label:
        "Sepanjang hari, kelelawar terjaga dengan posisi terbalik di tempat-tempat terpencil, seperti atap gua, bagian bawah jembatan, atau bagian dalam pohon yang berlubang.",
      value: false,
    },
    {
      label:
        "Posisi ideal yang membantu kelelawar terbang adalah dengan tidur terbalik.",
      value: true,
    },
    {
      label:
        "Selain itu, kaki belakang kelelawar kecil dan sangat berkembang sehingga mereka tidak bisa berlari untuk menambah kecepatan saat lepas landas.",
      value: false,
    },
    {
      label:
        "Kelelawar menggunakan cakar belakang untuk naik ke tempat yang tinggi, kemudian terbang.",
      value: false,
    },
  ],
  en: [
    {
      label: "Bats fly to hunt insects and other animals during the day.",
      value: false,
    },
    {
      label:
        "All day long, bats stay awake upside down in secluded places, such as cave roofs, the underside of bridges, or inside hollow trees.",
      value: false,
    },
    {
      label:
        "The ideal position that helps bats fly is by sleeping upside down.",
      value: true,
    },
    {
      label:
        "In addition, bats' hind legs are small and highly developed so they cannot run to build up speed for takeoff.",
      value: false,
    },
    {
      label: "Bats use their hind claws to climb to a high place, then fly.",
      value: false,
    },
  ],
};

export default choices;
