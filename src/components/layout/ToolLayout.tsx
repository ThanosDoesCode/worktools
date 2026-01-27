import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from './Header';
import { RelatedTools } from './RelatedTools';

interface ToolLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  showRelatedTools?: boolean;
}

export function ToolLayout({ title, description, children, showRelatedTools = true }: ToolLayoutProps) {
  const location = useLocation();
  // Extract slug from path like "/tools/pdf-protect" -> "pdf-protect"
  const slug = location.pathname.replace('/tools/', '');

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-muted-foreground">{description}</p>
        </div>
        
        <div className="animate-fade-in">
          {children}
        </div>

        {showRelatedTools && (
          <RelatedTools currentSlug={slug} maxTools={4} />
        )}
      </main>
    </div>
  );
}
