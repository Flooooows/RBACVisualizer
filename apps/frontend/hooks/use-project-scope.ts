'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ProjectsResponse } from '../lib/api';

export function useProjectScope(): {
  loading: boolean;
  error: string | null;
  projectId: string | null;
  projects: ProjectsResponse['items'];
  setProjectId: (projectId: string) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectsResponse['items']>([]);

  const requestedProjectId = searchParams.get('projectId');

  useEffect(() => {
    let active = true;

    async function loadProjects(): Promise<void> {
      try {
        const result = await apiFetch<ProjectsResponse>('/projects');

        if (!active) {
          return;
        }

        setProjects(result.items);
        setError(null);

        const resolvedProjectId =
          result.items.find((project) => project.id === requestedProjectId)?.id ??
          result.items[0]?.id ??
          null;

        if (resolvedProjectId && resolvedProjectId !== requestedProjectId) {
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set('projectId', resolvedProjectId);
          router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load projects.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [pathname, requestedProjectId, router, searchParams]);

  const projectId = useMemo(
    () =>
      projects.find((project) => project.id === requestedProjectId)?.id ?? projects[0]?.id ?? null,
    [projects, requestedProjectId],
  );

  function setProjectId(nextProjectId: string): void {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('projectId', nextProjectId);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return {
    loading,
    error,
    projectId,
    projects,
    setProjectId,
  };
}
