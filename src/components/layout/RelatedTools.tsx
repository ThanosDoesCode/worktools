import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tool, tools } from "@/lib/tools";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedToolsProps {
  currentSlug: string;
  maxTools?: number;
}

const categoryColors: Record<string, string> = {
  communication: "bg-info-light text-info",
  finance: "bg-success-light text-success",
  operations: "bg-accent text-accent-foreground",
  hr: "bg-warning-light text-warning",
  pdfs: "bg-primary/10 text-primary",
  files: "bg-muted text-muted-foreground",
};

export function RelatedTools({ currentSlug, maxTools = 4 }: RelatedToolsProps) {
  const currentTool = tools.find((t) => t.slug === currentSlug);
  
  if (!currentTool) return null;

  // Get tools from the same category, excluding the current tool
  const relatedTools = tools
    .filter((t) => t.category === currentTool.category && t.slug !== currentSlug)
    .slice(0, maxTools);

  if (relatedTools.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">Related Tools</h3>
        <div className="space-y-3">
          {relatedTools.map((tool) => {
            const IconComponent = (Icons as any)[tool.icon] || Icons.Wrench;
            
            return (
              <Link
                key={tool.id}
                to={`/tools/${tool.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-muted/50 transition-colors group"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    categoryColors[tool.category] || "bg-muted text-muted-foreground"
                  )}
                >
                  <IconComponent className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                    {tool.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
