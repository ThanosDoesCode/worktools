import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useVault } from '@/hooks/useVault';
import { getToolBySlug } from '@/lib/tools';
import {
  History,
  Trash2,
  Play,
  Copy,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function VaultPage() {
  const { jobs, isLoading, deleteJob, clearAll, getRerunUrl } = useVault();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleDuplicate = async (job: typeof jobs[0]) => {
    const url = getRerunUrl(job);
    await navigator.clipboard.writeText(window.location.origin + url);
    toast.success('Settings link copied - save as preset in the tool');
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      toast.success('Job removed from history');
    } catch {
      toast.error('Failed to delete job');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAll();
      toast.success('History cleared');
      setClearDialogOpen(false);
    } catch {
      toast.error('Failed to clear history');
    }
  };

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

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <History className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Vault</h1>
          </div>
          <p className="text-muted-foreground">
            Your recent jobs and settings — re-run or save as presets
          </p>
        </div>

        {jobs.length > 0 && (
          <div className="flex justify-end mb-4">
            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all job history. Your saved presets will not be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No history yet</h3>
            <p className="text-muted-foreground mb-4">
              Run any tool and your jobs will appear here
            </p>
            <Button asChild>
              <Link to="/">Browse Tools</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const tool = getToolBySlug(job.toolSlug);
              return (
                <div
                  key={job.id}
                  className="bg-surface-elevated rounded-xl border border-border p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground truncate">
                          {tool?.name || job.toolSlug}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(job.timestamp), 'MMM d, yyyy h:mm a')}
                      </p>
                      {job.inputMeta.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {job.inputMeta.map((m) => m.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="default" size="sm" asChild>
                        <Link to={getRerunUrl(job)}>
                          <Play className="h-4 w-4 mr-1" />
                          Re-run
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(job)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/tools/${job.toolSlug}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(job.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
