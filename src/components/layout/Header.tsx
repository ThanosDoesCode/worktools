import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Wrench className="h-5 w-5 text-primary" />
          <span className="text-lg tracking-tight">WORKTOOLS</span>
        </Link>
        <nav className="ml-auto flex items-center gap-6">
          <Link 
            to="/" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            All Tools
          </Link>
        </nav>
      </div>
    </header>
  );
}
