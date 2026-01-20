import { tools } from '@/lib/tools';
import { ToolCard } from '@/components/ui/tool-card';
import { Star } from 'lucide-react';

// Featured tools for the homepage
const popularToolIds = ['3', '7', '10', '1']; // Margin, VAT, Meeting, Email

export function PopularTools() {
  const popularTools = tools.filter(t => popularToolIds.includes(t.id));
  
  return (
    <section className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Popular Tools</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {popularTools.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}
