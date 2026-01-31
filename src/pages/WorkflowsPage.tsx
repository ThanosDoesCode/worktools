import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkflows } from '@/hooks/useWorkflows';
import { tools, getToolBySlug } from '@/lib/tools';
import {
  Workflow,
  Plus,
  Play,
  Trash2,
  Edit2,
  MoreVertical,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const {
    workflows,
    isLoading,
    createWorkflow,
    renameWorkflow,
    deleteWorkflow,
    addStep,
    removeStep,
    reorderSteps,
    getStepUrl,
  } = useWorkflows();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [addStepDialogOpen, setAddStepDialogOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string>('');
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const handleCreate = async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }
    try {
      await createWorkflow(workflowName.trim());
      toast.success('Workflow created');
      setCreateDialogOpen(false);
      setWorkflowName('');
    } catch {
      toast.error('Failed to create workflow');
    }
  };

  const handleRename = async () => {
    if (!editingWorkflowId || !workflowName.trim()) return;
    try {
      await renameWorkflow(editingWorkflowId, workflowName.trim());
      toast.success('Workflow renamed');
      setRenameDialogOpen(false);
      setEditingWorkflowId(null);
      setWorkflowName('');
    } catch {
      toast.error('Failed to rename workflow');
    }
  };

  const handleDelete = async (workflowId: string) => {
    try {
      await deleteWorkflow(workflowId);
      toast.success('Workflow deleted');
    } catch {
      toast.error('Failed to delete workflow');
    }
  };

  const handleAddStep = async () => {
    if (!selectedWorkflowId || !selectedToolSlug) return;
    try {
      await addStep(selectedWorkflowId, {
        toolSlug: selectedToolSlug,
        settings: {},
      });
      toast.success('Step added');
      setAddStepDialogOpen(false);
      setSelectedToolSlug('');
    } catch {
      toast.error('Failed to add step');
    }
  };

  const openRenameDialog = (workflowId: string, name: string) => {
    setEditingWorkflowId(workflowId);
    setWorkflowName(name);
    setRenameDialogOpen(true);
  };

  const openAddStepDialog = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    setAddStepDialogOpen(true);
  };

  const startWorkflow = (workflowId: string) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow || workflow.steps.length === 0) {
      toast.error('Workflow has no steps');
      return;
    }
    setRunningWorkflow(workflowId);
    setCurrentStep(0);
    const url = getStepUrl(workflow.steps[0]);
    navigate(url);
  };

  const nextStep = () => {
    if (!runningWorkflow) return;
    const workflow = workflows.find((w) => w.id === runningWorkflow);
    if (!workflow) return;

    const next = currentStep + 1;
    if (next >= workflow.steps.length) {
      toast.success('Workflow complete!');
      setRunningWorkflow(null);
      setCurrentStep(0);
      return;
    }

    setCurrentStep(next);
    const url = getStepUrl(workflow.steps[next]);
    navigate(url);
  };

  const runningWorkflowData = runningWorkflow
    ? workflows.find((w) => w.id === runningWorkflow)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <Link 
          to="/" 
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Tools
        </Link>

        {/* Running Workflow Banner */}
        {runningWorkflowData && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">
                  Running: {runningWorkflowData.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Step {currentStep + 1} of {runningWorkflowData.steps.length}:{' '}
                  {getToolBySlug(runningWorkflowData.steps[currentStep].toolSlug)?.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={nextStep}>
                  {currentStep + 1 >= runningWorkflowData.steps.length
                    ? 'Finish'
                    : 'Next Step'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRunningWorkflow(null);
                    setCurrentStep(0);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Workflow className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Workflows</h1>
          </div>
          <p className="text-muted-foreground">
            Chain tools together and run them step-by-step
          </p>
        </div>

        <div className="flex justify-end mb-4">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12">
            <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No workflows yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a workflow to chain tools together
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-surface-elevated rounded-xl border border-border p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-foreground">{workflow.name}</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => startWorkflow(workflow.id)}
                      disabled={workflow.steps.length === 0}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddStepDialog(workflow.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Step
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openRenameDialog(workflow.id, workflow.name)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(workflow.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {workflow.steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No steps yet</p>
                ) : (
                  <div className="space-y-2">
                    {workflow.steps.map((step, index) => {
                      const tool = getToolBySlug(step.toolSlug);
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground w-6">
                            {index + 1}.
                          </span>
                          <span className="flex-1 text-sm text-foreground truncate">
                            {tool?.name || step.toolSlug}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reorderSteps(workflow.id, index, Math.max(0, index - 1))}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                reorderSteps(
                                  workflow.id,
                                  index,
                                  Math.min(workflow.steps.length - 1, index + 1)
                                )
                              }
                              disabled={index === workflow.steps.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(workflow.id, index)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
              <DialogDescription>
                Give your workflow a name, then add steps
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="My workflow"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Workflow</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="rename-workflow">New Name</Label>
              <Input
                id="rename-workflow"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Workflow name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRename}>Rename</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Step Dialog */}
        <Dialog open={addStepDialogOpen} onOpenChange={setAddStepDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Step</DialogTitle>
              <DialogDescription>
                Select a tool to add to this workflow
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="step-tool">Tool</Label>
              <Select value={selectedToolSlug} onValueChange={setSelectedToolSlug}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((tool) => (
                    <SelectItem key={tool.slug} value={tool.slug}>
                      {tool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddStepDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStep} disabled={!selectedToolSlug}>
                Add Step
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
