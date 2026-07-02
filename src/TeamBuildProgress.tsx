import {
  currentSubphaseProgressPercent,
  currentTeamBuildLabels,
  teamBuildProgressPercent,
  themeParkTemplate,
  type TeamBuildState,
} from "./teamBuildModel";

type TeamBuildProgressProps = {
  state: TeamBuildState;
  onBack: () => void;
};

function formatWeight(weight: number) {
  return `${Math.max(0, Math.round(weight)).toLocaleString()} lb`;
}

function subphaseClass(state: TeamBuildState, subphaseId: string) {
  if (state.completedSubphaseIds.includes(subphaseId)) {
    return "complete";
  }

  if (state.currentSubphaseId === subphaseId) {
    return "active";
  }

  return "locked";
}

export function TeamBuildProgress({ state, onBack }: TeamBuildProgressProps) {
  const labels = currentTeamBuildLabels(state, themeParkTemplate);
  const totalProgress = teamBuildProgressPercent(state);
  const currentProgress = currentSubphaseProgressPercent(state);
  const remainingForReveal = Math.max(
    0,
    state.currentSubphaseRequiredWeight - state.currentSubphaseContributedWeight
  );

  return (
    <main className="app">
      <section className="card team-build-card">
        <h1>{state.name}</h1>
        <p className="subtitle">
          {state.status === "completed"
            ? "Opening day is ready."
            : `${labels.majorProjectName} - ${labels.phaseName}`}
        </p>

        <div className="team-build-visual" aria-label={`${state.name} progress`}>
          <div className={`park-part entrance-path ${subphaseClass(state, "front_path")}`} />
          <div className={`park-part ticket-booth ${subphaseClass(state, "ticket_booth")}`} />
          <div className={`park-part entry-arch ${subphaseClass(state, "entry_arch")}`} />
          <div className={`park-part park-sign ${subphaseClass(state, "park_sign")}`}>PARK</div>
          <div className={`park-part gate-lights ${subphaseClass(state, "gate_lights")}`} />
          <div className={`park-part team-banner ${subphaseClass(state, "team_banner")}`}>TEAM</div>

          <div className={`park-part central-path ${subphaseClass(state, "central_path")}`} />
          <div className={`park-part benches ${subphaseClass(state, "benches")}`} />
          <div className={`park-part food-stand ${subphaseClass(state, "stand_shell")}`} />
          <div className={`park-part stand-awning ${subphaseClass(state, "stand_awning")}`} />
          <div className={`park-part game-booth ${subphaseClass(state, "booth_shell")}`} />
          <div className={`park-part prizes-lights ${subphaseClass(state, "prizes_lights")}`} />

          <div className={`park-part wheel-footings ${subphaseClass(state, "wheel_footings")}`} />
          <div className={`park-part loading-platform ${subphaseClass(state, "loading_platform")}`} />
          <div className={`park-part wheel-frame ${subphaseClass(state, "wheel_frame")}`} />
          <div className={`park-part gondolas ${subphaseClass(state, "gondolas")}`} />
          <div className={`park-part wheel-lights ${subphaseClass(state, "wheel_lights")}`} />
          <div className={`park-part wheel-complete ${subphaseClass(state, "wheel_complete")}`} />
        </div>

        <div className="team-build-progress-panel">
          <div>
            <span>Total progress</span>
            <strong>{totalProgress}%</strong>
          </div>
          <div className="team-build-meter" aria-hidden="true">
            <span style={{ width: `${totalProgress}%` }} />
          </div>
          <div>
            <span>Next reveal</span>
            <strong>{state.status === "completed" ? "Complete" : `${currentProgress}%`}</strong>
          </div>
          {state.status !== "completed" && (
            <p>
              {formatWeight(remainingForReveal)} until {labels.subphaseName.toLowerCase()}.
            </p>
          )}
          <p>
            {formatWeight(state.totalContributedWeight)} delivered of {formatWeight(state.totalRequiredWeight)}.
          </p>
        </div>

        <button className="primary-button" onClick={onBack}>
          Back
        </button>
      </section>
    </main>
  );
}
