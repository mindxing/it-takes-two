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
  version: number;
  name: string;
  description: string;
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

export const defaultTeamBuildId = "theme_park_001";

export const themeParkTemplate: TeamBuildTemplate = {
  id: "theme_park",
  version: 1,
  name: "Opening Day Theme Park",
  description: "Build the entrance, midway, and first big ride for opening day.",
  majorProjects: [
    {
      id: "main_entrance",
      name: "Main Entrance",
      phases: [
        {
          id: "foundation",
          name: "Foundation",
          subphases: [
            { id: "front_path", name: "Front path appears", requiredWeight: 8_000 },
            { id: "ticket_booth", name: "Ticket booth appears", requiredWeight: 12_000 },
          ],
        },
        {
          id: "gate",
          name: "Gate",
          subphases: [
            { id: "entry_arch", name: "Entry arch appears", requiredWeight: 14_000 },
            { id: "park_sign", name: "Sign fills with color", requiredWeight: 8_000 },
          ],
        },
        {
          id: "lights",
          name: "Lights",
          subphases: [
            { id: "gate_lights", name: "Small lights turn on", requiredWeight: 6_000 },
            { id: "team_banner", name: "Team banner appears", requiredWeight: 7_000 },
          ],
        },
      ],
    },
    {
      id: "midway",
      name: "Midway",
      phases: [
        {
          id: "path",
          name: "Path",
          subphases: [
            { id: "central_path", name: "Central path fills in", requiredWeight: 10_000 },
            { id: "benches", name: "Benches appear", requiredWeight: 6_000 },
          ],
        },
        {
          id: "food_stand",
          name: "Food Stand",
          subphases: [
            { id: "stand_shell", name: "Stand appears", requiredWeight: 10_000 },
            { id: "stand_awning", name: "Awning fills with color", requiredWeight: 7_000 },
          ],
        },
        {
          id: "game_booth",
          name: "Game Booth",
          subphases: [
            { id: "booth_shell", name: "Booth appears", requiredWeight: 9_000 },
            { id: "prizes_lights", name: "Prizes and signs light up", requiredWeight: 8_000 },
          ],
        },
      ],
    },
    {
      id: "ferris_wheel",
      name: "Ferris Wheel",
      phases: [
        {
          id: "base",
          name: "Base",
          subphases: [
            { id: "wheel_footings", name: "Footings appear", requiredWeight: 12_000 },
            { id: "loading_platform", name: "Loading platform fills in", requiredWeight: 10_000 },
          ],
        },
        {
          id: "wheel",
          name: "Wheel",
          subphases: [
            { id: "wheel_frame", name: "Frame appears", requiredWeight: 18_000 },
            { id: "gondolas", name: "Gondolas fill in", requiredWeight: 14_000 },
          ],
        },
        {
          id: "opening",
          name: "Opening",
          subphases: [
            { id: "wheel_lights", name: "Lights turn on", requiredWeight: 8_000 },
            { id: "wheel_complete", name: "Wheel appears complete", requiredWeight: 10_000 },
          ],
        },
      ],
    },
  ],
};

export function totalTemplateRequiredWeight(template = themeParkTemplate) {
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
  buildId = defaultTeamBuildId,
  groupId,
  now,
  template = themeParkTemplate,
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
    id: buildId,
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
  template = themeParkTemplate,
}: {
  state: TeamBuildState;
  weight: number;
  now: string;
  template?: TeamBuildTemplate;
}) {
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

export function currentTeamBuildLabels(state: TeamBuildState, template = themeParkTemplate) {
  const majorProject = template.majorProjects.find((item) => item.id === state.currentMajorId);
  const phase = majorProject?.phases.find((item) => item.id === state.currentPhaseId);
  const subphase = phase?.subphases.find((item) => item.id === state.currentSubphaseId);

  return {
    majorProjectName: majorProject?.name ?? "Theme Park",
    phaseName: phase?.name ?? "Current Phase",
    subphaseName: subphase?.name ?? "Next reveal",
  };
}
