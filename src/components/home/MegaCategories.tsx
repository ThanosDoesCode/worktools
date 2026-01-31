import { useMemo } from "react";
import { tools, Tool } from "@/lib/tools";
import { CategoryCard } from "./CategoryCard";

// Helper functions
function isPdfToSomething(tool: Tool) {
  const name = tool.name.toLowerCase();
  return tool.slug.startsWith("pdf-to-") || name.startsWith("pdf to");
}

function isSomethingToPdf(tool: Tool) {
  const name = tool.name.toLowerCase();
  return (
    (tool.slug.endsWith("-to-pdf") || name.endsWith("to pdf")) &&
    !tool.slug.startsWith("pdf-to-")
  );
}

function isCalculator(tool: Tool) {
  const name = tool.name.toLowerCase();
  return (
    name.includes("calculator") ||
    name.includes("forecast") ||
    tool.category === "finance" ||
    tool.category === "hr"
  );
}

function isGenerator(tool: Tool) {
  return tool.category === "generators" || tool.slug === "generator-tools";
}

function isFileUtility(tool: Tool) {
  return tool.category === "files";
}

function isBusinessDocs(tool: Tool) {
  return (
    tool.slug === "business-docs" ||
    tool.slug === "career-kit" ||
    tool.slug === "email-signature-generator"
  );
}

export function MegaCategories() {
  const categories = useMemo(() => {
    // PDF Tools
    const pdfTools = tools.filter((t) => t.category === "pdfs");
    const pdfToOther = pdfTools.filter(isPdfToSomething);
    const otherToPdf = pdfTools.filter(isSomethingToPdf);
    const pdfUtilities = pdfTools.filter(
      (t) => !isPdfToSomething(t) && !isSomethingToPdf(t)
    );

    // Calculators
    const calculatorTools = tools.filter(isCalculator);

    // Generators
    const generatorTools = tools.filter(isGenerator);

    // File Utilities
    const fileTools = tools.filter(isFileUtility);

    // Business & Career
    const businessTools = tools.filter(isBusinessDocs);

    return [
      {
        id: "pdfs",
        title: "PDF Tools",
        description: "Convert, merge, split, compress, and manage PDF files",
        icon: "FileText",
        gradient: "bg-gradient-to-br from-red-500 to-rose-600",
        toolCount: pdfTools.length,
        subCategories: [
          { title: "Convert to PDF", tools: otherToPdf },
          { title: "Convert from PDF", tools: pdfToOther },
          { title: "PDF Utilities", tools: pdfUtilities },
        ],
      },
      {
        id: "calculators",
        title: "Calculators",
        description: "Business calculators for finance, pricing, and HR",
        icon: "Calculator",
        gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
        toolCount: calculatorTools.length,
        tools: calculatorTools,
      },
      {
        id: "generators",
        title: "Generators",
        description: "Create QR codes, passwords, barcodes, and more",
        icon: "Sparkles",
        gradient: "bg-gradient-to-br from-violet-500 to-purple-600",
        toolCount: generatorTools.length,
        tools: generatorTools,
      },
      {
        id: "files",
        title: "File Utilities",
        description: "Convert, compress, and optimize images and files",
        icon: "FolderOpen",
        gradient: "bg-gradient-to-br from-blue-500 to-cyan-600",
        toolCount: fileTools.length,
        tools: fileTools,
      },
      {
        id: "business",
        title: "Business & Career",
        description: "Create invoices, resumes, signatures, and documents",
        icon: "Briefcase",
        gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
        toolCount: businessTools.length,
        tools: businessTools,
      },
    ];
  }, []);

  return (
    <section className="space-y-4">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          id={category.id}
          title={category.title}
          description={category.description}
          icon={category.icon}
          gradient={category.gradient}
          toolCount={category.toolCount}
          subCategories={category.subCategories}
          tools={category.tools}
        />
      ))}
    </section>
  );
}
