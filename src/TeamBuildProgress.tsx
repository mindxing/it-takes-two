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

function MonumentReveal({
  state,
  template,
  className = "",
}: {
  state: TeamBuildState;
  template: TeamBuildTemplate;
  className?: string;
}) {
  const revealPercent = progressForTemplate(state, template);

  return (
    <div
      className={`monument-visual ${className}`}
      style={{ "--reveal-progress": `${revealPercent}%` } as CSSProperties}
      aria-label={`${template.name} progress`}
    >
      <img className="monument-image grey" src={template.imagePath} alt="" aria-hidden="true" />
      <img className="monument-image color" src={template.imagePath} alt="" aria-hidden="true" />
    </div>
  );
}

export function MonumentDashboard({
  state,
  groupName,
}: {
  state: TeamBuildState;
  groupName: string;
}) {
  const template = teamBuildTemplateForTheme(state.themeId);

  return (
    <div className="monument-dashboard">
      <p className="home-kicker" data-team={groupName} aria-hidden="true" />
      <h1 className="home-title-graphic" aria-label="It Takes Two!">
        <svg viewBox="0 0 420 130" role="presentation" aria-hidden="true">
          <defs>
            <path id="home-title-arc" d="M 28 94 C 118 16, 302 16, 392 94" />
          </defs>
          <text className="home-title-shadow">
            <textPath href="#home-title-arc" startOffset="50%" textAnchor="middle">
              IT TAKES TWO!
            </textPath>
          </text>
          <text className="home-title-stroke">
            <textPath href="#home-title-arc" startOffset="50%" textAnchor="middle">
              IT TAKES TWO!
            </textPath>
          </text>
          <text className="home-title-fill">
            <textPath href="#home-title-arc" startOffset="50%" textAnchor="middle">
              IT TAKES TWO!
            </textPath>
          </text>
        </svg>
      </h1>
      <MonumentReveal state={state} template={template} className="home-monument-visual" />
      <img className="workout-avatar avatar-victoria" src="/avatar-victoria.png?v=20260703-clean" alt="" aria-hidden="true" />
      <img className="workout-avatar avatar-mike" src="/avatar-mike.png?v=20260703-clean" alt="" aria-hidden="true" />
    </div>
  );
}

export function CompletedMonumentsView({
  state,
  onBack,
}: {
  state: TeamBuildState;
  onBack: () => void;
}) {
  const template = teamBuildTemplateForTheme(state.themeId);
  const completed = state.status === "completed";

  return (
    <main className="app">
      <section className="card monument-card">
        <h1>Completed</h1>
        <p className="subtitle">Finished monuments will collect here.</p>
        <div className="completed-monuments-grid">
          {completed ? (
            <div className="completed-monument-card">
              <img src={template.imagePath} alt="" />
              <strong>{template.name}</strong>
              <span>{formatWeight(state.totalRequiredWeight)} placed</span>
            </div>
          ) : (
            <div className="empty-monument-state">
              <strong>No completed monuments yet</strong>
              <span>{template.name} is currently under construction.</span>
            </div>
          )}
        </div>
        <button className="primary-button" onClick={onBack}>
          Back
        </button>
      </section>
    </main>
  );
}

export function MonumentMapView({
  state,
  onBack,
}: {
  state: TeamBuildState;
  onBack: () => void;
}) {
  return (
    <main className="app">
      <section className="card monument-card">
        <h1>Monument Map</h1>
        <p className="subtitle">Current and future projects</p>
        <div className="monument-map">
          {monumentTemplates.map((template, index) => {
            const isActive = template.id === state.themeId;
            const isLocked = !isActive;

            return (
              <div
                key={template.id}
                className={isActive ? "monument-map-node active" : "monument-map-node locked"}
              >
                <div className="map-node-index">{index + 1}</div>
                <img src={template.imagePath} alt="" className={isLocked ? "locked-preview" : ""} />
                <div>
                  <strong>{template.name}</strong>
                  <span>{isActive ? "Current project" : "Future monument"}</span>
                </div>
              </div>
            );
          })}
        </div>
        <button className="primary-button" onClick={onBack}>
          Back
        </button>
      </section>
    </main>
  );
}

export function TeamBuildProgress({ state, onBack }: TeamBuildProgressProps) {
  const activeTemplate = teamBuildTemplateForTheme(state.themeId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(activeTemplate.id);
  const selectedTemplate = teamBuildTemplateForTheme(selectedTemplateId);
  const selectedIsActive = selectedTemplate.id === state.themeId;
  const labels = currentTeamBuildLabels(state);
  const totalProgress = selectedIsActive ? teamBuildProgressPercent(state) : 0;
  const currentProgress = selectedIsActive ? currentSubphaseProgressPercent(state) : 0;
  const remainingForReveal = Math.max(
    0,
    state.currentSubphaseRequiredWeight - state.currentSubphaseContributedWeight
  );

  return (
    <main className="app">
      <section className="card monument-card progress-orbit-card">
        <div className="progress-orbit" aria-label="Monument options">
          <div className="orbit-side left">
            {monumentTemplates.filter((template) => template.id !== selectedTemplate.id).slice(0, 2).map((template) => (
              <button
                key={template.id}
                className="orbit-thumb"
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                aria-label={template.name}
              >
                <img src={template.imagePath} alt="" />
              </button>
            ))}
          </div>

          <div className="orbit-current">
            <MonumentReveal state={state} template={selectedTemplate} className="orbit-current-visual" />
          </div>

          <div className="orbit-side right">
            {monumentTemplates.filter((template) => template.id !== selectedTemplate.id).slice().reverse().slice(0, 2).map((template) => (
              <button
                key={template.id}
                className="orbit-thumb"
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                aria-label={template.name}
              >
                <img src={template.imagePath} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="progress-copy">
          <h1>{selectedTemplate.name}</h1>
          <p>
            {selectedIsActive
              ? state.status === "completed" ? "Complete" : `${labels.phaseName} - ${labels.subphaseName}`
              : selectedTemplate.description}
          </p>
        </div>

        <div className="monument-tabs compact-tabs" aria-label="Monument options">
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
