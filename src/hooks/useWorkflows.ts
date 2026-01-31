import { useState, useEffect, useCallback } from 'react';
import {
  Workflow,
  WorkflowStep,
  listWorkflows,
  upsertWorkflow as upsertWorkflowDb,
  deleteWorkflow as deleteWorkflowDb,
} from '@/lib/localDb';
import { encodeToolState } from '@/lib/urlState';

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const wfs = await listWorkflows();
      setWorkflows(wfs);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
    setIsLoading(false);
  };

  const createWorkflow = useCallback(async (name: string, steps: WorkflowStep[] = []) => {
    try {
      const workflow = await upsertWorkflowDb({ name, steps });
      setWorkflows((prev) => [workflow, ...prev]);
      return workflow;
    } catch (error) {
      console.error('Failed to create workflow:', error);
      throw error;
    }
  }, []);

  const updateWorkflow = useCallback(async (workflow: Workflow) => {
    try {
      const updated = await upsertWorkflowDb(workflow);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? updated : w))
      );
      return updated;
    } catch (error) {
      console.error('Failed to update workflow:', error);
      throw error;
    }
  }, []);

  const renameWorkflow = useCallback(async (workflowId: string, newName: string) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    try {
      const updated = await upsertWorkflowDb({ ...workflow, name: newName });
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? updated : w))
      );
    } catch (error) {
      console.error('Failed to rename workflow:', error);
      throw error;
    }
  }, [workflows]);

  const deleteWorkflow = useCallback(async (workflowId: string) => {
    try {
      await deleteWorkflowDb(workflowId);
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      throw error;
    }
  }, []);

  const addStep = useCallback(async (workflowId: string, step: WorkflowStep) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const updated = { ...workflow, steps: [...workflow.steps, step] };
    return updateWorkflow(updated);
  }, [workflows, updateWorkflow]);

  const removeStep = useCallback(async (workflowId: string, stepIndex: number) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const updated = {
      ...workflow,
      steps: workflow.steps.filter((_, i) => i !== stepIndex),
    };
    return updateWorkflow(updated);
  }, [workflows, updateWorkflow]);

  const reorderSteps = useCallback(async (workflowId: string, fromIndex: number, toIndex: number) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const steps = [...workflow.steps];
    const [removed] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, removed);

    const updated = { ...workflow, steps };
    return updateWorkflow(updated);
  }, [workflows, updateWorkflow]);

  const getStepUrl = useCallback((step: WorkflowStep): string => {
    const encoded = encodeToolState(step.toolSlug, step.settings);
    return `/tools/${step.toolSlug}?state=${encoded}`;
  }, []);

  return {
    workflows,
    isLoading,
    createWorkflow,
    updateWorkflow,
    renameWorkflow,
    deleteWorkflow,
    addStep,
    removeStep,
    reorderSteps,
    getStepUrl,
    refreshWorkflows: loadWorkflows,
  };
}
