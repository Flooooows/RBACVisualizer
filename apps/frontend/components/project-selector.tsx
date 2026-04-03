'use client';

import type { ProjectsResponse } from '../lib/api';

type ProjectSelectorProps = {
  loading: boolean;
  error: string | null;
  projectId: string | null;
  projects: ProjectsResponse['items'];
  onChange: (projectId: string) => void;
};

export function ProjectSelector({
  loading,
  error,
  projectId,
  projects,
  onChange,
}: ProjectSelectorProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
        Project scope
      </label>
      <select
        value={projectId ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading || projects.length === 0}
        className="app-select min-w-[220px]"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.workspaceName} / {project.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
