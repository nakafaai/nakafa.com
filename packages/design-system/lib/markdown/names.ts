/** Canonical component names shared by the base registry and renderer manifest. */
export const baseComponentNames = {
  agentContext: "AgentContext",
  anchor: "a",
  blockMath: "BlockMath",
  blockquote: "blockquote",
  code: "code",
  codeBlock: "CodeBlock",
  contentBlock: "ContentBlock",
  contentGrid: "ContentGrid",
  contentStack: "ContentStack",
  emphasis: "em",
  heading1: "h1",
  heading2: "h2",
  heading3: "h3",
  heading4: "h4",
  heading5: "h5",
  heading6: "h6",
  highlight: "Highlight",
  inlineMath: "InlineMath",
  listItem: "li",
  mathContainer: "MathContainer",
  mathVisual: "MathVisual",
  mermaid: "Mermaid",
  orderedList: "ol",
  paragraph: "p",
  pre: "pre",
  strong: "strong",
  subscript: "sub",
  superscript: "sup",
  table: "table",
  tableBody: "tbody",
  tableCell: "td",
  tableHead: "th",
  tableHeader: "thead",
  tableRow: "tr",
  unorderedList: "ul",
  youtube: "Youtube",
} as const;

/** Canonical semantic names implemented for every MDX document. */
export const semanticComponentNames = [
  baseComponentNames.heading1,
  baseComponentNames.heading2,
  baseComponentNames.heading3,
  baseComponentNames.heading4,
  baseComponentNames.heading5,
  baseComponentNames.heading6,
  baseComponentNames.paragraph,
  baseComponentNames.orderedList,
  baseComponentNames.unorderedList,
  baseComponentNames.listItem,
  baseComponentNames.emphasis,
  baseComponentNames.strong,
  baseComponentNames.blockquote,
  baseComponentNames.anchor,
  baseComponentNames.code,
  baseComponentNames.table,
  baseComponentNames.tableHeader,
  baseComponentNames.tableBody,
  baseComponentNames.tableRow,
  baseComponentNames.tableHead,
  baseComponentNames.tableCell,
  baseComponentNames.pre,
  baseComponentNames.superscript,
  baseComponentNames.subscript,
] as const;

/** Canonical rich component names owned by chemistry routes. */
export const chemistryComponentNames = {
  ancientAtomLab: "AncientAtomLab",
  atomShellLab: "AtomShellLab",
  atomSymbolLab: "AtomSymbolLab",
  chemicalReactionCharacteristicsLab: "ChemicalReactionCharacteristicsLab",
  chemicalReactionTypesLab: "ChemicalReactionTypesLab",
  combiningVolumesLab: "CombiningVolumesLab",
  constantCompositionLab: "ConstantCompositionLab",
  daltonEvidenceLab: "DaltonEvidenceLab",
  electronConfigurationLab: "ElectronConfigurationLab",
  ionLab: "IonLab",
  isotopeLab: "IsotopeLab",
  massConservationLab: "MassConservationLab",
  matterParticleReaderLab: "MatterParticleReaderLab",
  methaneCombustionEquationLab: "MethaneCombustionEquationLab",
  modernPeriodicTableLab: "ModernPeriodicTableLab",
  multipleProportionsLab: "MultipleProportionsLab",
  periodicPropertiesLab: "PeriodicPropertiesLab",
  subatomicParticlePropertiesLab: "SubatomicParticlePropertiesLab",
  subatomicParticlesLab: "SubatomicParticlesLab",
  valenceElectronLab: "ValenceElectronLab",
} as const;

/** Canonical rich component names owned by AI and data-science routes. */
export const aiDsComponentNames = {
  lineEquation: "LineEquation",
} as const;

/** Canonical rich component names owned by biology routes. */
export const biologyComponentNames = {
  bacteriaStructureLab: "BacteriaStructureLab",
  climateObservationLab: "ClimateObservationLab",
  fungiMyceliumLab: "FungiMyceliumLab",
  greenhouseEffectLab: "GreenhouseEffectLab",
  sarsCov2VirionLab: "SarsCov2VirionLab",
  virusMorphologyLab: "VirusMorphologyLab",
  virusReplicationLab: "VirusReplicationLab",
  virusRoleLab: "VirusRoleLab",
  virusStructureLab: "VirusStructureLab",
} as const;

/** Canonical rich component names owned by mathematics routes. */
export const mathematicsComponentNames = {
  bacterialGrowth: "BacterialGrowth",
  barChart: "BarChart",
  functionAndNonFunctionDiagram: "FunctionAndNonFunctionDiagram",
  functionAndNonFunctionRelationVisualizer:
    "FunctionAndNonFunctionRelationVisualizer",
  functionChart: "FunctionChart",
  functionExplorationVirusChart: "FunctionExplorationVirusChart",
  functionMachine: "FunctionMachine",
  histogramChart: "HistogramChart",
  inequality: "Inequality",
  inverseFunctionIllustration: "InverseFunctionIllustration",
  lineEquation: "LineEquation",
  quadraticEquationReadingRoomProblem: "QuadraticEquationReadingRoomProblem",
  scatterDiagram: "ScatterDiagram",
  sequenceConceptTableChairsAnimation: "SequenceConceptTableChairsAnimation",
  triangle: "Triangle",
  unitCircle: "UnitCircle",
  vectorChart: "VectorChart",
} as const;

/** Canonical rich component names owned by physics routes. */
export const physicsComponentNames = {
  accelerationGraphCard: "AccelerationGraphCard",
  accelerationLab: "AccelerationLab",
  averageVelocitySpeedLab: "AverageVelocitySpeedLab",
  dimensionLab: "DimensionLab",
  displacementDistanceLab: "DisplacementDistanceLab",
  instantaneousVelocitySpeedLab: "InstantaneousVelocitySpeedLab",
  lineEquation: "LineEquation",
  measurementToolsLab: "MeasurementToolsLab",
  nonUniformLinearMotionGraphCard: "NonUniformLinearMotionGraphCard",
  nonUniformLinearMotionLab: "NonUniformLinearMotionLab",
  parabolicMovementAnalysisLab: "ParabolicMovementAnalysisLab",
  parabolicMovementLab: "ParabolicMovementLab",
  relativeMovementLab: "RelativeMovementLab",
  stoppingDistanceLab: "StoppingDistanceLab",
  uniformCircularMotionLab: "UniformCircularMotionLab",
  uniformLinearMotionLab: "UniformLinearMotionLab",
  vectorConceptLab: "VectorConceptLab",
  velocitySpeedLab: "VelocitySpeedLab",
  verticalMovementLab: "VerticalMovementLab",
  windEnergyConversionLab: "WindEnergyConversionLab",
} as const;

/** Canonical rich component names owned by politics articles. */
export const politicsComponentNames = {
  kimPlusElectabilityChart: "KimPlusElectabilityChart",
  merahPutihCabinetChart: "MerahPutihCabinetChart",
  merahPutihCompositionChart: "MerahPutihCompositionChart",
  nepotismStage: "NepotismStage",
  nepotismStateTable: "NepotismStateTable",
  porkBarrelBudgetChart: "PorkBarrelBudgetChart",
  porkBarrelElectabilityChart: "PorkBarrelElectabilityChart",
  porkBarrelFundChart: "PorkBarrelFundChart",
} as const;

/** Public site pages intentionally own no rich MDX implementations. */
export const siteComponentNames = {} as const;

/** SNBT general-reasoning routes own no rich MDX implementations. */
export const snbtGeneralComponentNames = {} as const;

/** Canonical rich component names owned by SNBT mathematical-reasoning routes. */
export const snbtMathComponentNames = {
  lineEquation: "LineEquation",
  numberLine: "NumberLine",
} as const;

/** SNBT plain-text routes intentionally own no rich MDX implementations. */
export const snbtPlainComponentNames = {} as const;

/** Canonical rich component names owned by SNBT quantitative-knowledge routes. */
export const snbtQuantComponentNames = {
  lineEquation: "LineEquation",
  numberLine: "NumberLine",
  unitCircle: "UnitCircle",
} as const;

/** Mathematical rendering capabilities shared by TKA subject routes. */
export const tkaMathComponentNames = {
  histogramChart: "HistogramChart",
  lineEquation: "LineEquation",
  numberLine: "NumberLine",
} as const;
