import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchTools, Tool } from '@/lib/tools';
import { ToolCard } from '@/components/ui/tool-card';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tool[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (query.trim()) {
      setResults(searchTools(query));
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search for a tool... (e.g., VAT, margin, invoice)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          className="h-14 pl-12 pr-4 text-base bg-background border-border shadow-sm focus-visible:ring-primary"
        />
      </div>
      
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-border bg-card shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-2 space-y-1">
            {results.map(tool => (
              <ToolCard key={tool.id} tool={tool} size="compact" />
            ))}
          </div>
        </div>
      )}
      
      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-border bg-card p-6 shadow-lg z-50">
          <p className="text-center text-muted-foreground">No tools found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
