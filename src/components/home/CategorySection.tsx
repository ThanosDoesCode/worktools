import { categories, getToolsByCategory } from '@/lib/tools';
import { ToolCard } from '@/components/ui/tool-card';
import { Mail, DollarSign, Settings, Users } from 'lucide-react';

const categoryIcons: Record<string, React.ReactNode> = {
  communication: <Mail className="h-5 w-5" />,
  finance: <DollarSign className="h-5 w-5" />,
  operations: <Settings className="h-5 w-5" />,
  hr: <Users className="h-5 w-5" />,
};

const categoryColors: Record<string, string> = {
  communication: 'bg-info-light text-info',
  finance: 'bg-success-light text-success',
  operations: 'bg-accent text-accent-foreground',
  hr: 'bg-warning-light text-warning',
};

export function CategorySection() {
  return (
    <section className="space-y-12">
      {categories.map(category => {
        const categoryTools = getToolsByCategory(category.id);
        if (categoryTools.length === 0) return null;
        
        return (
          <div key={category.id} className="animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${categoryColors[category.id]}`}>
                {categoryIcons[category.id]}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">{category.name}</h2>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
