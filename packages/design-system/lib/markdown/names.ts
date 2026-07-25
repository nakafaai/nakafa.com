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
  inlineMath: "InlineMath",
  listItem: "li",
  mathContainer: "MathContainer",
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
  vector3d: "Vector3d",
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
  measurementToolsLab: "MeasurementToolsLab",
  nonUniformLinearMotionGraphCard: "NonUniformLinearMotionGraphCard",
  nonUniformLinearMotionLab: "NonUniformLinearMotionLab",
  parabolicMovementAnalysisLab: "ParabolicMovementAnalysisLab",
  parabolicMovementLab: "ParabolicMovementLab",
  relativeMovementLab: "RelativeMovementLab",
  stoppingDistanceLab: "StoppingDistanceLab",
  uniformCircularMotionLab: "UniformCircularMotionLab",
  uniformLinearMotionLab: "UniformLinearMotionLab",
  vector3d: "Vector3d",
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

/** Canonical rich component names owned by SNBT general-reasoning routes. */
export const snbtGeneralComponentNames = {
  set10Question2RecruitmentChart: "Set10Question2RecruitmentChart",
  set2Question15SalesChart: "Set2Question15SalesChart",
  set2Question5SalesChart: "Set2Question5SalesChart",
  set3Question14SpiceSalesChart: "Set3Question14SpiceSalesChart",
  set4Question14PriceChart: "Set4Question14PriceChart",
  set5Question18GrowthChart: "Set5Question18GrowthChart",
  set5Question6SalesChart: "Set5Question6SalesChart",
  set7Question9VisitorChart: "Set7Question9VisitorChart",
  set8Question17ProfitChart: "Set8Question17ProfitChart",
  set8Question1SalesChart: "Set8Question1SalesChart",
  set9Question9GraduationChart: "Set9Question9GraduationChart",
} as const;

/** Canonical rich component names owned by SNBT mathematical-reasoning routes. */
export const snbtMathComponentNames = {
  numberLine: "NumberLine",
  set2Question19Graph: "Set2Question19Graph",
  set2Question6Graph: "Set2Question6Graph",
  set3Question18Graph: "Set3Question18Graph",
  set3Question18GraphSolution: "Set3Question18GraphSolution",
  set3Question19Graph: "Set3Question19Graph",
  set4Question18Graph: "Set4Question18Graph",
  set4Question19Graph: "Set4Question19Graph",
  set4Question4Graph: "Set4Question4Graph",
  set4Question5Graph: "Set4Question5Graph",
  set6Question18Graph: "Set6Question18Graph",
  set6Question19Graph: "Set6Question19Graph",
  set6Question5Graph: "Set6Question5Graph",
  set7Question18Graph: "Set7Question18Graph",
  set7Question19Graph: "Set7Question19Graph",
  set7Question4Graph: "Set7Question4Graph",
} as const;

/** SNBT plain-text routes intentionally own no rich MDX implementations. */
export const snbtPlainComponentNames = {} as const;

/** Canonical rich component names owned by SNBT quantitative-knowledge routes. */
export const snbtQuantComponentNames = {
  lineEquation: "LineEquation",
  numberLine: "NumberLine",
  set10Question1Graph: "Set10Question1Graph",
  set10Question2Graph: "Set10Question2Graph",
  set10Question8Graph: "Set10Question8Graph",
  set3Question13Illustration: "Set3Question13Illustration",
  set5Question12Graph: "Set5Question12Graph",
  set5Question9Graph: "Set5Question9Graph",
  set6Question12Graph: "Set6Question12Graph",
  set6Question19Graph: "Set6Question19Graph",
  set7Question13Graph: "Set7Question13Graph",
  set7Question14Graph: "Set7Question14Graph",
  set7Question1Graph: "Set7Question1Graph",
  set8Question20Graph: "Set8Question20Graph",
  set9Question1Graph: "Set9Question1Graph",
  set9Question2Graph: "Set9Question2Graph",
  set9Question3Graph: "Set9Question3Graph",
  unitCircle: "UnitCircle",
} as const;

/** Canonical rich component names owned by TKA mathematics routes. */
export const tkaMathComponentNames = {
  histogramChart: "HistogramChart",
  lineEquation: "LineEquation",
  numberLine: "NumberLine",
  set1Question19Graph: "Set1Question19Graph",
  set1Question30Illustration: "Set1Question30Illustration",
} as const;
