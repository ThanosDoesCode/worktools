import { categories, getToolsByCategory } from "@/lib/tools";
import { ToolCard } from "@/components/ui/tool-card";
import { Mail, DollarSign, Settings, Users, FileText } from "lucide-react";

const categoryIcons: Record<string, React.ReactNode> = {
  communication: <Mail className="h-5 w-5" />,
  finance: <DollarSign className="h-5 w-5" />,
  operations: <Settings className="h-5 w-5" />,
  hr: <Users className="h-5 w-5" />,
  pdfs: <FileText className="h-5 w-5" />,
};

const categoryColors: Record<string, string> = {
  communication: "bg-info-light text-info",
  finance: "bg-success-light text-success",
  operations: "bg-accent text-accent-foreground",
  hr: "bg-warning-light text-warning",
  pdfs: "bg-primary/10 text-primary",
};

function isPdfToSomething(tool: { slug: string; name: string }) {
  const name = tool.name.toLowerCase();
  return tool.slug.startsWith("pdf-to-") || name.startsWith("pdf to");
}

function isSomethingToPdf(tool: { slug: string; name: string }) {
  const name = tool.name.toLowerCase();
  return tool.slug.endsWith("-to-pdf") || name.endsWith("to pdf");
}

export function CategorySection() {
  return (
    <section className="space-y-12">
      {categories.map((category) => {
        const categoryTools = getToolsByCategory(category.id);
        if (categoryTools.length === 0) return null;

        const isPDFs = category.id === "pdfs";

        // Split only the PDFs category into 2 groups
        const pdfToSomething = isPDFs ? categoryTools.filter(isPdfToSomething) : [];
        const somethingToPdf = isPDFs ? categoryTools.filter(isSomethingToPdf) : [];

        // Fallback: anything not matching the patterns (in case you add future PDF tools like "Compress PDF")
        const otherPdfTools = isPDFs ? categoryTools.filter((t) => !isPdfToSomething(t) && !isSomethingToPdf(t)) : [];

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

            {!isPDFs ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            ) : (
              <div className="space-y-10">
                {/* PDF -> Something */}
                {pdfToSomething.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">PDF → Other formats</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {pdfToSomething.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Something -> PDF */}
                {somethingToPdf.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Other formats → PDF</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {somethingToPdf.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other PDF tools (e.g., Merge PDFs, Split PDF, Compress PDF, OCR, etc.) */}
                {otherPdfTools.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">PDF tools</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {otherPdfTools.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
