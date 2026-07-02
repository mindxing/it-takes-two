import { useState } from "react";
import type { CSSProperties } from "react";
import {
  currentSubphaseProgressPercent,
  currentTeamBuildLabels,
  monumentTemplates,
  teamBuildProgressPercent,
  teamBuildTemplateForTheme,
  type TeamBuildState,
  type TeamBuildTemplate,
} from "./teamBuildModel";

type TeamBuildProgressProps = {
  state: TeamBuildState;
  onBack: () => void;
};

function formatWeight(weight: number) {
  return `${Math.max(0, Math.round(weight)).toLocaleString()} lb`;
}

function progressForTemplate(state: TeamBuildState, template: TeamBuildTemplate) {
  if (template.id !== state.themeId) return 0;
  return teamBuildProgressPercent(state);
}

export function TeamBuildProgress({ state, onBack }: TeamBuildProgressProps) {
  const activeTemplate = teamBuildTemplateForTheme(state.themeId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(activeTemplate.id);
  const selectedTemplate = teamBuildTemplateForTheme(selectedTemplateId);
  const selectedIsActive = selectedTemplate.id === state.themeId;
  const labels = currentTeamBuildLabels(state);
  const totalProgress = selectedIsActive ? teamBuildProgressPercent(state) : 0;
  const currentProgress = selectedIsActive ? currentSubphaseProgressPercent(state) : 0;
  const revealPercent = progressForTemplate(state, selectedTemplate);
  const remainingForReveal = Math.max(
    0,
    state.currentSubphaseRequiredWeight - state.currentSubphaseContributedWeight
  );

  return (
    <main className="app">
      <section className="card monument-card">
        <h1>{selectedTemplate.name}</h1>
        <p className="subtitle">
          {selectedIsActive
            ? state.status === "completed" ? "Complete" : `${labels.phaseName} - ${labels.subphaseName}`
            : selectedTemplate.description}
        </p>

        <div className="monument-tabs" aria-label="Monument options">
          {monumentTemplates.map((template) => (
            <button
              key={template.id}
              className={template.id === selectedTemplate.id ? "monument-tab selected" : "monument-tab"}
              type="button"
              onClick={() => setSelectedTemplateId(template.id)}
            >
              {template.shortName}
            </button>
          ))}
        </div>

        <div
          className="monument-visual"
          style={{ "--reveal-progress": `${revealPercent}%` } as CSSProperties}
          aria-label={`${selectedTemplate.name} progress`}
        >
          <img className="monument-image grey" src={selectedTemplate.imagePath} alt="" aria-hidden="true" />
          <img className="monument-image color" src={selectedTemplate.imagePath} alt="" aria-hidden="true" />
        </div>

        <div className="team-build-progress-panel">
          <div>
            <span>Total progress</span>
            <strong>{totalProgress}%</strong>
          </div>
          <div className="team-build-meter" aria-hidden="true">
            <span style={{ width: `${totalProgress}%`, background: selectedTemplate.accentColor }} />
          </div>
          <div>
            <span>Next section</span>
            <strong>{selectedIsActive ? `${currentProgress}%` : "Preview"}</strong>
          </div>
          {selectedIsActive && state.status !== "completed" && (
            <p>
              {formatWeight(remainingForReveal)} until {labels.subphaseName.toLowerCase()}.
            </p>
          )}
          {selectedIsActive && (
            <p>
              {formatWeight(state.totalContributedWeight)} placed of {formatWeight(state.totalRequiredWeight)}.
            </p>
          )}
        </div>

        <button className="primary-button" onClick={onBack}>
          Back
        </button>
      </section>
    </main>
  );
}
