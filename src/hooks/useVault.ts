import { useState, useEffect, useCallback } from 'react';
import {
  VaultJob,
  listVaultJobs,
  addVaultJob as addVaultJobDb,
  deleteVaultJob as deleteVaultJobDb,
  clearVault as clearVaultDb,
} from '@/lib/localDb';
import { encodeToolState } from '@/lib/urlState';

export function useVault() {
  const [jobs, setJobs] = useState<VaultJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const vaultJobs = await listVaultJobs();
      setJobs(vaultJobs);
    } catch (error) {
      console.error('Failed to load vault jobs:', error);
    }
    setIsLoading(false);
  };

  const addJob = useCallback(async (
    toolSlug: string,
    settingsSnapshot: Record<string, unknown>,
    inputMeta: Array<{ name: string; size?: number }> = []
  ) => {
    try {
      const job = await addVaultJobDb({
        toolSlug,
        settingsSnapshot,
        inputMeta,
      });
      setJobs((prev) => [job, ...prev.slice(0, 99)]);
      return job;
    } catch (error) {
      console.error('Failed to add vault job:', error);
      throw error;
    }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    try {
      await deleteVaultJobDb(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (error) {
      console.error('Failed to delete vault job:', error);
      throw error;
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await clearVaultDb();
      setJobs([]);
    } catch (error) {
      console.error('Failed to clear vault:', error);
      throw error;
    }
  }, []);

  const getRerunUrl = useCallback((job: VaultJob): string => {
    const encoded = encodeToolState(job.toolSlug, job.settingsSnapshot);
    return `/tools/${job.toolSlug}?state=${encoded}`;
  }, []);

  return {
    jobs,
    isLoading,
    addJob,
    deleteJob,
    clearAll,
    getRerunUrl,
    refreshJobs: loadJobs,
  };
}
