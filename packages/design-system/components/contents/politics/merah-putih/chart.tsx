import { Bar } from "@repo/design-system/components/evilcharts/charts/bar/series";
import {
  EvilBarChart,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { getBarSeriesCue } from "@repo/design-system/lib/charts/cue";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

const VALUE_AXIS_PADDING_RATIO = 0.12;
const VALUE_LABEL_MARGIN = 16;

interface SharedProps {
  description: NonNullable<ReactNode>;
  footnote: ReactNode;
  title: NonNullable<ReactNode>;
}

interface CabinetChartProps extends SharedProps {
  labels: {
    cabinet: ReactNode;
  };
}

interface CompositionChartProps extends SharedProps {
  labels: {
    female: ReactNode;
    gender: string;
    incumbent: ReactNode;
    male: ReactNode;
    minister: string;
    new: ReactNode;
    nonPoliticians: ReactNode;
    politicalStatus: string;
    politicians: ReactNode;
  };
}

const CabinetChartData = [
  { name: "Reformasi Pembangunan", cabinet: 37 },
  { name: "Persatuan Nasional", cabinet: 36 },
  { name: "Gotong Royong", cabinet: 33 },
  { name: "Indonesia Bersatu", cabinet: 34 },
  { name: "Indonesia Bersatu II", cabinet: 34 },
  { name: "Kerja", cabinet: 34 },
  { name: "Indonesia Maju", cabinet: 34 },
  { name: "Merah Putih", cabinet: 48 },
];
const maxCabinetSize = Math.max(
  ...Arr.map(CabinetChartData, ({ cabinet }) => cabinet)
);
const cabinetAxisMax = Math.ceil(
  maxCabinetSize * (1 + VALUE_AXIS_PADDING_RATIO)
);
const COMPOSITION_CUES = {
  primary: getBarSeriesCue(0),
  secondary: getBarSeriesCue(1),
};

/** Renders the cabinet-size comparison used by the Merah Putih article. */
export function CabinetChart({
  title,
  description,
  footnote,
  labels,
}: CabinetChartProps) {
  const t = useTranslations("Common");
  const chartConfig = {
    cabinet: {
      label: labels.cabinet,
      colors: { light: [PLOT_COLORS.orange], dark: [PLOT_COLORS.orange] },
    },
  } satisfies ChartConfig;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody>
        <EvilBarChart
          chartProps={{ margin: { right: VALUE_LABEL_MARGIN } }}
          className="min-h-80 p-(--card-spacing)"
          config={chartConfig}
          data={CabinetChartData}
          layout="horizontal"
        >
          <Grid horizontal={false} />
          <YAxis dataKey="name" tickMargin={10} />
          <XAxis dataKey="cabinet" domain={[0, cabinetAxisMax]} hide />
          <Tooltip />
          <Bar
            barProps={{ label: { position: "right", fontSize: 12 } }}
            dataKey="cabinet"
            radius={8}
          />
          <Legend />
        </EvilBarChart>
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("source")} value={footnote} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Renders the cabinet-composition comparison used by the Merah Putih article. */
export function CompositionChart({
  title,
  description,
  footnote,
  labels,
}: CompositionChartProps) {
  const t = useTranslations("Common");
  const MinisterChartData = [{ name: labels.minister, new: 31, incumbent: 18 }];
  const GenderChartData = [{ name: labels.gender, male: 43, female: 5 }];
  const PoliticalStatusChartData = [
    {
      name: labels.politicalStatus,
      politician: 23,
      non_politician: 25,
    },
  ];

  const ministerChartConfig = {
    new: {
      cue: COMPOSITION_CUES.primary,
      label: labels.new,
      colors: { light: [PLOT_COLORS.orange], dark: [PLOT_COLORS.orange] },
    },
    incumbent: {
      cue: COMPOSITION_CUES.secondary,
      label: labels.incumbent,
      colors: { light: [PLOT_COLORS.teal], dark: [PLOT_COLORS.teal] },
    },
  } satisfies ChartConfig;

  const genderChartConfig = {
    male: {
      cue: COMPOSITION_CUES.primary,
      label: labels.male,
      colors: { light: [PLOT_COLORS.orange], dark: [PLOT_COLORS.orange] },
    },
    female: {
      cue: COMPOSITION_CUES.secondary,
      label: labels.female,
      colors: { light: [PLOT_COLORS.teal], dark: [PLOT_COLORS.teal] },
    },
  } satisfies ChartConfig;

  const politicalStatusChartConfig = {
    politician: {
      cue: COMPOSITION_CUES.primary,
      label: labels.politicians,
      colors: { light: [PLOT_COLORS.orange], dark: [PLOT_COLORS.orange] },
    },
    non_politician: {
      cue: COMPOSITION_CUES.secondary,
      label: labels.nonPoliticians,
      colors: { light: [PLOT_COLORS.teal], dark: [PLOT_COLORS.teal] },
    },
  } satisfies ChartConfig;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody>
        <div className="grid w-full grid-cols-1 gap-4 p-(--card-spacing) sm:grid-cols-2 lg:grid-cols-3">
          <EvilBarChart
            className="aspect-square"
            config={ministerChartConfig}
            data={MinisterChartData}
          >
            <Grid vertical={false} />
            <XAxis dataKey="name" tickMargin={10} />
            <Tooltip />
            <Bar
              dataKey="new"
              radius={COMPOSITION_CUES.primary.radius}
              variant={COMPOSITION_CUES.primary.variant}
            />
            <Bar
              dataKey="incumbent"
              radius={COMPOSITION_CUES.secondary.radius}
              variant={COMPOSITION_CUES.secondary.variant}
            />
            <Legend />
          </EvilBarChart>

          <EvilBarChart
            className="aspect-square"
            config={genderChartConfig}
            data={GenderChartData}
          >
            <Grid vertical={false} />
            <XAxis dataKey="name" tickMargin={10} />
            <Tooltip />
            <Bar
              dataKey="male"
              radius={COMPOSITION_CUES.primary.radius}
              variant={COMPOSITION_CUES.primary.variant}
            />
            <Bar
              dataKey="female"
              radius={COMPOSITION_CUES.secondary.radius}
              variant={COMPOSITION_CUES.secondary.variant}
            />
            <Legend />
          </EvilBarChart>

          <EvilBarChart
            className="aspect-square"
            config={politicalStatusChartConfig}
            data={PoliticalStatusChartData}
          >
            <Grid vertical={false} />
            <XAxis dataKey="name" tickMargin={10} />
            <Tooltip />
            <Bar
              dataKey="politician"
              radius={COMPOSITION_CUES.primary.radius}
              variant={COMPOSITION_CUES.primary.variant}
            />
            <Bar
              dataKey="non_politician"
              radius={COMPOSITION_CUES.secondary.radius}
              variant={COMPOSITION_CUES.secondary.variant}
            />
            <Legend />
          </EvilBarChart>
        </div>
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("source")} value={footnote} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
