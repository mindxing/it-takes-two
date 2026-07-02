export type TeamBuildStatus = "active" | "completed";

export type TeamBuildSubphase = {
  id: string;
  name: string;
  requiredWeight: number;
};

export type TeamBuildPhase = {
  id: string;
  name: string;
  subphases: TeamBuildSubphase[];
};

export type TeamBuildMajorProject = {
  id: string;
  name: string;
  phases: TeamBuildPhase[];
};

export type TeamBuildTemplate = {
  id: string;
  buildId: string;
  version: number;
  name: string;
  shortName: string;
  description: string;
  imagePath: string;
  accentColor: string;
  majorProjects: TeamBuildMajorProject[];
};

export type TeamBuildState = {
  id: string;
  groupId: string;
  themeId: string;
  templateVersion: number;
  name: string;
  status: TeamBuildStatus;
  startedAt: string;
  completedAt?: string;
  totalRequiredWeight: number;
  totalContributedWeight: number;
  currentMajorIndex: number;
  currentPhaseIndex: number;
  currentSubphaseIndex: number;
  currentMajorId: string;
  currentPhaseId: string;
  currentSubphaseId: string;
  currentSubphaseRequiredWeight: number;
  currentSubphaseContributedWeight: number;
  completedSubphaseIds: string[];
  completedPhaseIds: string[];
  completedMajorIds: string[];
  updatedAt: string;
};

type TeamBuildPosition = {
  majorIndex: number;
  phaseIndex: number;
  subphaseIndex: number;
};

const pyramidPhases: TeamBuildPhase[] = [
  {
    id: "foundation",
    name: "Foundation",
    subphases: [
      { id: "survey_site", name: "Survey the site", requiredWeight: 20_000 },
      { id: "lay_foundation", name: "Lay foundation stones", requiredWeight: 35_000 },
      { id: "build_entry", name: "Build the entry path", requiredWeight: 25_000 },
    ],
  },
  {
    id: "lower_tiers",
    name: "Lower Tiers",
    subphases: [
      { id: "lower_left", name: "Place lower left blocks", requiredWeight: 40_000 },
      { id: "lower_center", name: "Place lower center blocks", requiredWeight: 45_000 },
      { id: "lower_right", name: "Place lower right blocks", requiredWeight: 40_000 },
    ],
  },
  {
    id: "middle_tiers",
    name: "Middle Tiers",
    subphases: [
      { id: "middle_left", name: "Raise middle left blocks", requiredWeight: 35_000 },
      { id: "middle_center", name: "Raise middle center blocks", requiredWeight: 40_000 },
      { id: "middle_right", name: "Raise middle right blocks", requiredWeight: 35_000 },
    ],
  },
  {
    id: "upper_tiers",
    name: "Upper Tiers",
    subphases: [
      { id: "upper_left", name: "Stack upper left blocks", requiredWeight: 28_000 },
      { id: "upper_center", name: "Stack upper center blocks", requiredWeight: 32_000 },
      { id: "upper_right", name: "Stack upper right blocks", requiredWeight: 28_000 },
    ],
  },
  {
    id: "capstone",
    name: "Capstone",
    subphases: [
      { id: "set_capstone", name: "Set the capstone", requiredWeight: 25_000 },
      { id: "polish_faces", name: "Polish the faces", requiredWeight: 20_000 },
      { id: "sunrise_finish", name: "Light the monument", requiredWeight: 22_000 },
    ],
  },
];

const stackedStonePhases: TeamBuildPhase[] = [
  {
    id: "foundation",
    name: "Foundation",
    subphases: [
      { id: "prepare_plaza", name: "Prepare the plaza", requiredWeight: 20_000 },
      { id: "set_footings", name: "Set deep footings", requiredWeight: 35_000 },
      { id: "place_base", name: "Place base stones", requiredWeight: 35_000 },
    ],
  },
  {
    id: "lower_sections",
    name: "Lower Sections",
    subphases: [
      { id: "lower_course_one", name: "Raise first course", requiredWeight: 35_000 },
      { id: "lower_course_two", name: "Raise second course", requiredWeight: 35_000 },
      { id: "lower_band", name: "Install lower band", requiredWeight: 28_000 },
    ],
  },
  {
    id: "middle_sections",
    name: "Middle Sections",
    subphases: [
      { id: "middle_course_one", name: "Raise middle course", requiredWeight: 32_000 },
      { id: "middle_course_two", name: "Brace the monument", requiredWeight: 32_000 },
      { id: "middle_band", name: "Install middle band", requiredWeight: 28_000 },
    ],
  },
  {
    id: "upper_sections",
    name: "Upper Sections",
    subphases: [
      { id: "upper_course_one", name: "Raise upper course", requiredWeight: 28_000 },
      { id: "upper_course_two", name: "Set upper stones", requiredWeight: 28_000 },
      { id: "upper_trim", name: "Finish upper trim", requiredWeight: 22_000 },
    ],
  },
  {
    id: "crown",
    name: "Crown",
    subphases: [
      { id: "set_crown", name: "Set the crown", requiredWeight: 24_000 },
      { id: "gold_finish", name: "Add gold finish", requiredWeight: 18_000 },
      { id: "dedication", name: "Complete the dedication", requiredWeight: 20_000 },
    ],
  },
];

export const monumentTemplates: TeamBuildTemplate[] = [
  {
    id: "sunstone_pyramid",
    buildId: "sunstone_pyramid_001",
    version: 1,
    name: "Sunstone Pyramid",
    shortName: "Pyramid",
    description: "Stack sandstone blocks from the foundation to the capstone.",
    imagePath: "/team-monument-sunstone-pyramid.png",
    accentColor: "#d97706",
    majorProjects: [{ id: "pyramid", name: "Pyramid", phases: pyramidPhases }],
  },
  {
    id: "victory_obelisk",
    buildId: "victory_obelisk_001",
    version: 1,
    name: "Victory Obelisk",
    shortName: "Obelisk",
    description: "Raise a stone obelisk section by section.",
    imagePath: "/team-monument-victory-obelisk.png",
    accentColor: "#0f766e",
    majorProjects: [{ id: "obelisk", name: "Obelisk", phases: stackedStonePhases }],
  },
  {
    id: "founders_arch",
    buildId: "founders_arch_001",
    version: 1,
    name: "Founders Arch",
    shortName: "Arch",
    description: "Build a triumphal arch from base blocks to crown.",
    imagePath: "/team-monument-founders-arch.png",
    accentColor: "#b45309",
    majorProjects: [{ id: "arch", name: "Arch", phases: stackedStonePhases }],
  },
];

export const defaultTeamBuildTemplate = monumentTemplates[0];
export const defaultTeamBuildId = defaultTeamBuildTemplate.buildId;

export function teamBuildTemplateForTheme(themeId: string) {
  return monumentTemplates.find((template) => template.id === themeId) ?? defaultTeamBuildTemplate;
}

export function totalTemplateRequiredWeight(template = defaultTeamBuildTemplate) {
  return template.majorProjects.reduce(
    (majorTotal, majorProject) => majorTotal + majorProject.phases.reduce(
      (phaseTotal, phase) => phaseTotal + phase.subphases.reduce(
        (subphaseTotal, subphase) => subphaseTotal + subphase.requiredWeight,
        0
      ),
      0
    ),
    0
  );
}

function currentTemplateSubphase(template: TeamBuildTemplate, position: TeamBuildPosition) {
  return template.majorProjects[position.majorIndex]?.phases[position.phaseIndex]?.subphases[position.subphaseIndex];
}

function currentTemplatePhase(template: TeamBuildTemplate, position: TeamBuildPosition) {
  return template.majorProjects[position.majorIndex]?.phases[position.phaseIndex];
}

function currentTemplateMajorProject(template: TeamBuildTemplate, position: TeamBuildPosition) {
  return template.majorProjects[position.majorIndex];
}

function nextPosition(template: TeamBuildTemplate, position: TeamBuildPosition): TeamBuildPosition | null {
  const phase = currentTemplatePhase(template, position);
  const majorProject = currentTemplateMajorProject(template, position);

  if (!phase || !majorProject) return null;
  if (position.subphaseIndex + 1 < phase.subphases.length) {
    return { ...position, subphaseIndex: position.subphaseIndex + 1 };
  }
  if (position.phaseIndex + 1 < majorProject.phases.length) {
    return { majorIndex: position.majorIndex, phaseIndex: position.phaseIndex + 1, subphaseIndex: 0 };
  }
  if (position.majorIndex + 1 < template.majorProjects.length) {
    return { majorIndex: position.majorIndex + 1, phaseIndex: 0, subphaseIndex: 0 };
  }
  return null;
}

function phaseIsCompleted(state: TeamBuildState, phase: TeamBuildPhase) {
  return phase.subphases.every((subphase) => state.completedSubphaseIds.includes(subphase.id));
}

function majorProjectIsCompleted(state: TeamBuildState, majorProject: TeamBuildMajorProject) {
  return majorProject.phases.every((phase) => state.completedPhaseIds.includes(phase.id));
}

function applyPositionToState(
  state: TeamBuildState,
  template: TeamBuildTemplate,
  position: TeamBuildPosition,
  currentSubphaseContributedWeight: number
): TeamBuildState {
  const majorProject = currentTemplateMajorProject(template, position);
  const phase = currentTemplatePhase(template, position);
  const subphase = currentTemplateSubphase(template, position);

  if (!majorProject || !phase || !subphase) return state;

  return {
    ...state,
    currentMajorIndex: position.majorIndex,
    currentPhaseIndex: position.phaseIndex,
    currentSubphaseIndex: position.subphaseIndex,
    currentMajorId: majorProject.id,
    currentPhaseId: phase.id,
    currentSubphaseId: subphase.id,
    currentSubphaseRequiredWeight: subphase.requiredWeight,
    currentSubphaseContributedWeight,
  };
}

export function createInitialTeamBuildState({
  buildId,
  groupId,
  now,
  template = defaultTeamBuildTemplate,
}: {
  buildId?: string;
  groupId: string;
  now: string;
  template?: TeamBuildTemplate;
}): TeamBuildState {
  const position = { majorIndex: 0, phaseIndex: 0, subphaseIndex: 0 };
  const majorProject = currentTemplateMajorProject(template, position);
  const phase = currentTemplatePhase(template, position);
  const subphase = currentTemplateSubphase(template, position);

  if (!majorProject || !phase || !subphase) {
    throw new Error(`Team build template ${template.id} has no first subphase.`);
  }

  return {
    id: buildId ?? template.buildId,
    groupId,
    themeId: template.id,
    templateVersion: template.version,
    name: template.name,
    status: "active",
    startedAt: now,
    totalRequiredWeight: totalTemplateRequiredWeight(template),
    totalContributedWeight: 0,
    currentMajorIndex: position.majorIndex,
    currentPhaseIndex: position.phaseIndex,
    currentSubphaseIndex: position.subphaseIndex,
    currentMajorId: majorProject.id,
    currentPhaseId: phase.id,
    currentSubphaseId: subphase.id,
    currentSubphaseRequiredWeight: subphase.requiredWeight,
    currentSubphaseContributedWeight: 0,
    completedSubphaseIds: [],
    completedPhaseIds: [],
    completedMajorIds: [],
    updatedAt: now,
  };
}

export function applyWeightToTeamBuild({
  state,
  weight,
  now,
}: {
  state: TeamBuildState;
  weight: number;
  now: string;
}) {
  const template = teamBuildTemplateForTheme(state.themeId);
  const appliedWeight = Math.max(0, Math.floor(weight));

  if (appliedWeight <= 0 || state.status === "completed") return state;

  let nextState: TeamBuildState = {
    ...state,
    totalContributedWeight: Math.min(state.totalRequiredWeight, state.totalContributedWeight + appliedWeight),
    updatedAt: now,
  };
  let remainingWeight = appliedWeight;
  let position = {
    majorIndex: nextState.currentMajorIndex,
    phaseIndex: nextState.currentPhaseIndex,
    subphaseIndex: nextState.currentSubphaseIndex,
  };
  let currentSubphaseWeight = nextState.currentSubphaseContributedWeight;

  while (remainingWeight > 0) {
    const subphase = currentTemplateSubphase(template, position);
    const phase = currentTemplatePhase(template, position);
    const majorProject = currentTemplateMajorProject(template, position);

    if (!subphase || !phase || !majorProject) break;

    const neededWeight = Math.max(0, subphase.requiredWeight - currentSubphaseWeight);

    if (remainingWeight < neededWeight) {
      currentSubphaseWeight += remainingWeight;
      nextState = applyPositionToState(nextState, template, position, currentSubphaseWeight);
      break;
    }

    remainingWeight -= neededWeight;
    currentSubphaseWeight = subphase.requiredWeight;

    if (!nextState.completedSubphaseIds.includes(subphase.id)) {
      nextState = { ...nextState, completedSubphaseIds: [...nextState.completedSubphaseIds, subphase.id] };
    }
    if (phaseIsCompleted(nextState, phase) && !nextState.completedPhaseIds.includes(phase.id)) {
      nextState = { ...nextState, completedPhaseIds: [...nextState.completedPhaseIds, phase.id] };
    }
    if (majorProjectIsCompleted(nextState, majorProject) && !nextState.completedMajorIds.includes(majorProject.id)) {
      nextState = { ...nextState, completedMajorIds: [...nextState.completedMajorIds, majorProject.id] };
    }

    const followingPosition = nextPosition(template, position);
    if (!followingPosition) {
      nextState = {
        ...applyPositionToState(nextState, template, position, currentSubphaseWeight),
        status: "completed",
        completedAt: now,
        totalContributedWeight: nextState.totalRequiredWeight,
      };
      break;
    }

    position = followingPosition;
    currentSubphaseWeight = 0;
    nextState = applyPositionToState(nextState, template, position, currentSubphaseWeight);
  }

  return nextState;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parseTeamBuildState(value: unknown): TeamBuildState | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  if (
    typeof data.id !== "string" ||
    typeof data.groupId !== "string" ||
    typeof data.themeId !== "string" ||
    typeof data.name !== "string" ||
    (data.status !== "active" && data.status !== "completed")
  ) {
    return null;
  }

  return {
    id: data.id,
    groupId: data.groupId,
    themeId: data.themeId,
    templateVersion: Number(data.templateVersion ?? 1),
    name: data.name,
    status: data.status,
    startedAt: typeof data.startedAt === "string" ? data.startedAt : "",
    ...(typeof data.completedAt === "string" ? { completedAt: data.completedAt } : {}),
    totalRequiredWeight: Number(data.totalRequiredWeight ?? 0),
    totalContributedWeight: Number(data.totalContributedWeight ?? 0),
    currentMajorIndex: Number(data.currentMajorIndex ?? 0),
    currentPhaseIndex: Number(data.currentPhaseIndex ?? 0),
    currentSubphaseIndex: Number(data.currentSubphaseIndex ?? 0),
    currentMajorId: typeof data.currentMajorId === "string" ? data.currentMajorId : "",
    currentPhaseId: typeof data.currentPhaseId === "string" ? data.currentPhaseId : "",
    currentSubphaseId: typeof data.currentSubphaseId === "string" ? data.currentSubphaseId : "",
    currentSubphaseRequiredWeight: Number(data.currentSubphaseRequiredWeight ?? 0),
    currentSubphaseContributedWeight: Number(data.currentSubphaseContributedWeight ?? 0),
    completedSubphaseIds: parseStringArray(data.completedSubphaseIds),
    completedPhaseIds: parseStringArray(data.completedPhaseIds),
    completedMajorIds: parseStringArray(data.completedMajorIds),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

export function teamBuildProgressPercent(state: TeamBuildState) {
  if (state.totalRequiredWeight <= 0) return 0;
  return Math.min(100, Math.round((state.totalContributedWeight / state.totalRequiredWeight) * 100));
}

export function currentSubphaseProgressPercent(state: TeamBuildState) {
  if (state.currentSubphaseRequiredWeight <= 0) return 0;
  return Math.min(100, Math.round((state.currentSubphaseContributedWeight / state.currentSubphaseRequiredWeight) * 100));
}

export function currentTeamBuildLabels(state: TeamBuildState) {
  const template = teamBuildTemplateForTheme(state.themeId);
  const majorProject = template.majorProjects[state.currentMajorIndex];
  const phase = majorProject?.phases[state.currentPhaseIndex];
  const subphase = phase?.subphases[state.currentSubphaseIndex];

  return {
    majorProjectName: majorProject?.name ?? "Monument",
    phaseName: phase?.name ?? "Current Phase",
    subphaseName: subphase?.name ?? "Next stonework",
  };
}
