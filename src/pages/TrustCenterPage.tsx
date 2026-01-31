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
import { clearAllData } from '@/lib/localDb';
import {
  Shield,
  ArrowLeft,
  Cpu,
  CloudOff,
  HardDrive,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function TrustCenterPage() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleClearAll = async () => {
    try {
      await clearAllData();
      toast.success('All local data cleared');
      setClearDialogOpen(false);
    } catch {
      toast.error('Failed to clear data');
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
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Trust Center</h1>
          </div>
          <p className="text-muted-foreground">
            How we handle your data and privacy
          </p>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Core Principles */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-green-500/10 rounded-xl border border-green-500/20 p-6">
              <Cpu className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-semibold text-foreground mb-2">Local Processing</h3>
              <p className="text-sm text-muted-foreground">
                All tools run entirely in your browser. Your files never leave your device.
              </p>
            </div>

            <div className="bg-blue-500/10 rounded-xl border border-blue-500/20 p-6">
              <CloudOff className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-foreground mb-2">No Uploads</h3>
              <p className="text-sm text-muted-foreground">
                We don't upload, store, or process your files on any server.
              </p>
            </div>

            <div className="bg-purple-500/10 rounded-xl border border-purple-500/20 p-6">
              <HardDrive className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="font-semibold text-foreground mb-2">Local Storage</h3>
              <p className="text-sm text-muted-foreground">
                Presets and preferences are stored locally in your browser only.
              </p>
            </div>
          </div>

          {/* What We Store */}
          <div className="bg-surface-elevated rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              What's Stored Locally
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Presets</p>
                  <p className="text-sm text-muted-foreground">
                    Your saved tool settings and configurations
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Vault History</p>
                  <p className="text-sm text-muted-foreground">
                    Metadata about recent jobs (no file contents, just names and settings)
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Workflows</p>
                  <p className="text-sm text-muted-foreground">
                    Your custom tool chains and step configurations
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Preferences</p>
                  <p className="text-sm text-muted-foreground">
                    Default currency, quality presets, and company info
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* What We Don't Store */}
          <div className="bg-surface-elevated rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              What We Don't Store
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-destructive">✕</span>
                Your files (PDFs, images, documents)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-destructive">✕</span>
                Personal data or account information
              </li>
              <li className="flex items-center gap-2">
                <span className="text-destructive">✕</span>
                Usage analytics or tracking cookies
              </li>
              <li className="flex items-center gap-2">
                <span className="text-destructive">✕</span>
                Anything on external servers
              </li>
            </ul>
          </div>

          {/* Clear Data */}
          <div className="bg-surface-elevated rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Clear All Local Data
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Remove all presets, vault history, workflows, and preferences from your browser.
              This cannot be undone.
            </p>
            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all local data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your presets, vault history, workflows,
                    and preferences. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </main>
    </div>
  );
}
