import { Link } from "react-router-dom";
import { Tool } from "@/lib/tools";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  tool: Tool;
  size?: "default" | "compact";
}

const categoryColors: Record<string, string> = {
  communication: "bg-info-light text-info",
  finance: "bg-success-light text-success",
  operations: "bg-accent text-accent-foreground",
  hr: "bg-warning-light text-warning",
  pdfs: "bg-primary/10 text-primary",
  files: "bg-secondary text-secondary-foreground",
  generators: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200",
};

export function ToolCard({ tool, size = "default" }: ToolCardProps) {
  const IconComponent = (Icons as any)[tool.icon] || Icons.Wrench;

  return (
    <Link
      to={`/tools/${tool.slug}`}
      className={cn(
        "group block rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-tool-hover",
        size === "compact" && "p-4",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            categoryColors[tool.category] || "bg-muted text-muted-foreground",
          )}
        >
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "font-semibold text-foreground group-hover:text-primary transition-colors",
              size === "compact" ? "text-sm" : "text-base",
            )}
          >
            {tool.name}
          </h3>
          <p className={cn("mt-1 text-muted-foreground line-clamp-2", size === "compact" ? "text-xs" : "text-sm")}>
            {tool.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
