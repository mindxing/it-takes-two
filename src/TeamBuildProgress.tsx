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

const visibleProgressThumbCount = 3;
const progressThumbCenterIndex = Math.floor(visibleProgressThumbCount / 2);

function centeredProgressThumbOffset(index: number) {
  const maxThumbOffset = Math.max(0, monumentTemplates.length - visibleProgressThumbCount);
  return Math.min(maxThumbOffset, Math.max(0, index - progressThumbCenterIndex));
}

function progressForTemplate(state: TeamBuildState, template: TeamBuildTemplate, activeThemeId = state.themeId) {
  const activeTemplateIndex = monumentTemplates.findIndex((item) => item.id === activeThemeId);
  const templateIndex = monumentTemplates.findIndex((item) => item.id === template.id);
  if (templateIndex >= 0 && activeTemplateIndex >= 0 && templateIndex < activeTemplateIndex) return 100;
  if (template.id !== activeThemeId) return 0;
  return teamBuildProgressPercent(state);
}

function MonumentReveal({
  state,
  template,
  className = "",
  activeThemeId,
}: {
  state: TeamBuildState;
  template: TeamBuildTemplate;
  className?: string;
  activeThemeId?: string;
}) {
  const revealPercent = progressForTemplate(state, template, activeThemeId);

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
      <img className="workout-avatar avatar-victoria" src="/avatar-victoria-v4.png?v=20260703-v4" alt="" aria-hidden="true" />
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
  const displayActiveTemplate = monumentTemplates[1] ?? teamBuildTemplateForTheme(state.themeId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(displayActiveTemplate.id);
  const [thumbOffset, setThumbOffset] = useState(0);
  const selectedTemplate = teamBuildTemplateForTheme(selectedTemplateId);
  const activeTemplateIndex = monumentTemplates.findIndex((template) => template.id === displayActiveTemplate.id);
  const selectedTemplateIndex = monumentTemplates.findIndex((template) => template.id === selectedTemplate.id);
  const selectedIsActive = selectedTemplate.id === displayActiveTemplate.id;
  const selectedIsUnlocked = selectedTemplateIndex <= activeTemplateIndex;
  const labels = currentTeamBuildLabels(state);
  const totalProgress = selectedIsUnlocked ? progressForTemplate(state, selectedTemplate, displayActiveTemplate.id) : 0;
  const currentProgress = selectedIsActive ? currentSubphaseProgressPercent(state) : 0;
  const remainingForReveal = Math.max(
    0,
    state.currentSubphaseRequiredWeight - state.currentSubphaseContributedWeight
  );
  const visibleThumbs = monumentTemplates.slice(thumbOffset, thumbOffset + visibleProgressThumbCount);
  const canScrollLeft = thumbOffset > 0;
  const canScrollRight = thumbOffset + visibleThumbs.length < monumentTemplates.length;
  const maxThumbOffset = Math.max(0, monumentTemplates.length - visibleProgressThumbCount);

  function selectTemplateAtIndex(index: number) {
    const template = monumentTemplates[index];
    if (!template) return;
    setSelectedTemplateId(template.id);
    setThumbOffset(centeredProgressThumbOffset(index));
  }

  return (
    <main className="app">
      <section className="card monument-card progress-medallion-card">
        <div className="progress-copy">
          <h1>{selectedTemplate.name}</h1>
          <p>
            {selectedIsUnlocked
              ? selectedIsActive
                ? state.status === "completed" ? "Complete" : `${labels.phaseName} - ${labels.subphaseName}`
                : "Completed monument"
              : selectedTemplate.description}
          </p>
        </div>

        <div className={selectedIsUnlocked ? "progress-main-medallion" : "progress-main-medallion locked"}>
          {selectedIsUnlocked ? (
            <MonumentReveal
              state={state}
              template={selectedTemplate}
              className="progress-main-visual"
              activeThemeId={displayActiveTemplate.id}
            />
          ) : (
            <span aria-label={`${selectedTemplate.name} locked`}>?</span>
          )}
        </div>

        <div className={selectedIsUnlocked ? "team-build-progress-panel" : "team-build-progress-panel locked"}>
          <div>
            <span>Total progress</span>
            <strong>{selectedIsUnlocked ? `${totalProgress}%` : "Locked"}</strong>
          </div>
          <div className="team-build-meter" aria-hidden="true">
            <span style={{ width: selectedIsUnlocked ? `${totalProgress}%` : "0%", background: selectedTemplate.accentColor }} />
          </div>
          <div>
            <span>Next section</span>
            <strong>{selectedIsActive ? `${currentProgress}%` : selectedIsUnlocked ? "Complete" : "Hidden"}</strong>
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

        <div className="progress-thumb-carousel" aria-label="Monument timeline">
          <button
            className="progress-thumb-arrow"
            type="button"
            disabled={!canScrollLeft}
            onClick={() => setThumbOffset((offset) => Math.max(0, offset - 1))}
            aria-label="Scroll monuments left"
          >
            ‹
          </button>
          <div className="progress-thumb-list">
            {visibleThumbs.map((template) => {
              const templateIndex = monumentTemplates.findIndex((item) => item.id === template.id);
              const isUnlocked = templateIndex <= activeTemplateIndex;
              const isSelected = template.id === selectedTemplate.id;

              return (
                <button
                  key={template.id}
                  className={[
                    "progress-thumb-medallion",
                    isSelected ? "selected" : "",
                    isUnlocked ? "unlocked" : "locked",
                    template.id === displayActiveTemplate.id ? "current" : "",
                  ].filter(Boolean).join(" ")}
                  type="button"
                  onClick={() => selectTemplateAtIndex(templateIndex)}
                  aria-label={isUnlocked ? template.name : `${template.name} locked`}
                >
                  {isUnlocked ? (
                    <MonumentReveal
                      state={state}
                      template={template}
                      className="progress-thumb-visual"
                      activeThemeId={displayActiveTemplate.id}
                    />
                  ) : (
                    <span>?</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            className="progress-thumb-arrow"
            type="button"
            disabled={!canScrollRight}
            onClick={() => setThumbOffset((offset) => Math.min(maxThumbOffset, offset + 1))}
            aria-label="Scroll monuments right"
          >
            ›
          </button>
        </div>

        <button className="primary-button" onClick={onBack}>
          Back
        </button>
      </section>
    </main>
  );
}
