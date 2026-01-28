import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, Calculator, Sparkles, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: FileText, label: 'PDFs', path: '/?category=pdfs' },
  { icon: Calculator, label: 'Finance', path: '/?category=finance' },
  { icon: Sparkles, label: 'Generate', path: '/tools/generator-tools' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' && !location.search;
    }
    return currentPath.includes(path) || location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.slice(0, 2).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors",
              isActive(item.path) 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}

        {/* Center Action Button */}
        <Link
          to="/?focus=search"
          className="flex items-center justify-center -mt-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Search className="h-6 w-6" />
        </Link>

        {navItems.slice(2).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors",
              isActive(item.path) 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
      {/* Safe area for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-background" />
    </nav>
  );
}
