import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Dengan menunjukkan bahwa hasil kali titik vektor posisi A dan vektor arah garis singgung di A adalah positif.",
      value: false,
    },
    {
      label:
        "Dengan menunjukkan bahwa hasil kali silang vektor posisi A dan vektor arah garis singgung di A adalah vektor nol.",
      value: false,
    },
    {
      label:
        "Dengan menunjukkan bahwa hasil kali titik vektor posisi A dan vektor arah garis singgung di A adalah nol.",
      value: true,
    },
    {
      label:
        "Dengan menunjukkan bahwa vektor posisi A dan vektor arah garis singgung di A memiliki arah yang sama.",
      value: false,
    },
    {
      label:
        "Dengan menunjukkan bahwa vektor posisi A dan vektor arah garis singgung di A memiliki panjang yang sama.",
      value: false,
    },
  ],
  en: [
    {
      label:
        "By showing that the dot product of position vector A and the direction vector of the tangent line at A is positive.",
      value: false,
    },
    {
      label:
        "By showing that the cross product of position vector A and the direction vector of the tangent line at A is the zero vector.",
      value: false,
    },
    {
      label:
        "By showing that the dot product of position vector A and the direction vector of the tangent line at A is zero.",
      value: true,
    },
    {
      label:
        "By showing that position vector A and the direction vector of the tangent line at A have the same direction.",
      value: false,
    },
    {
      label:
        "By showing that position vector A and the direction vector of the tangent line at A have the same length.",
      value: false,
    },
  ],
};

export default choices;
