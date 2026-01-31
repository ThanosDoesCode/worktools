import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { Tool } from "@/lib/tools";

interface SubCategory {
  title: string;
  tools: Tool[];
}

interface CategoryCardProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  toolCount: number;
  gradient: string;
  subCategories?: SubCategory[];
  tools?: Tool[];
}

export function CategoryCard({
  id,
  title,
  description,
  icon,
  toolCount,
  gradient,
  subCategories,
  tools,
}: CategoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const IconComponent = (Icons as any)[icon] || Icons.Folder;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-all duration-300">
      {/* Header - Clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-4 sm:p-6 text-left transition-all duration-300",
          "hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isExpanded && "bg-muted/20"
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl",
              gradient
            )}
          >
            <IconComponent className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                {title}
              </h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {toolCount} tools
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {description}
            </p>
          </div>
          <div className="shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 space-y-6">
            {/* Sub-categories layout */}
            {subCategories && subCategories.length > 0 ? (
              subCategories.map((subCat, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {subCat.title}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {subCat.tools.map((tool) => (
                      <ToolLink key={tool.id} tool={tool} />
                    ))}
                  </div>
                </div>
              ))
            ) : tools && tools.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {tools.map((tool) => (
                  <ToolLink key={tool.id} tool={tool} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolLink({ tool }: { tool: Tool }) {
  const IconComponent = (Icons as any)[tool.icon] || Icons.Wrench;

  return (
    <Link
      to={`/tools/${tool.slug}`}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "bg-muted/40 hover:bg-muted transition-colors",
        "group"
      )}
    >
      <IconComponent className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
          {tool.name}
        </p>
      </div>
    </Link>
  );
}
