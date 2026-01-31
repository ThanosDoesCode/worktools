import { Link } from 'react-router-dom';
import { Wrench, History, Workflow, Settings, Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="text-lg tracking-tight">WORKTOOLS</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-4">
          <Link 
            to="/vault" 
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
            title="Vault"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Vault</span>
          </Link>
          <Link 
            to="/workflows" 
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
            title="Workflows"
          >
            <Workflow className="h-4 w-4" />
            <span className="hidden sm:inline">Workflows</span>
          </Link>
          <Link 
            to="/preferences" 
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
            title="Preferences"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </Link>
          <Link 
            to="/trust" 
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
            title="Trust Center"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Trust</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}