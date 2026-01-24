export interface Tool {
  id: string;
  name: string;
  description: string;
  category: "communication" | "finance" | "operations" | "hr" | "pdfs" | "files";
  slug: string;
  keywords: string[];
  icon: string;
}

export const tools: Tool[] = [
  // Communication
  {
    id: "1",
    name: "Email Signature Generator",
    description: "Create professional email signatures for Gmail, Outlook, and more",
    category: "communication",
    slug: "email-signature-generator",
    keywords: ["email", "signature", "gmail", "outlook", "professional"],
    icon: "Mail",
  },

  // Finance
  {
    id: "2",
    name: "Invoice Generator",
    description: "Create and download professional invoices instantly",
    category: "finance",
    slug: "invoice-generator",
    keywords: ["invoice", "billing", "pdf", "business"],
    icon: "FileText",
  },
  {
    id: "3",
    name: "Margin vs Markup Calculator",
    description: "Calculate profit margins and markup percentages instantly",
    category: "finance",
    slug: "margin-vs-markup-calculator",
    keywords: ["margin", "markup", "profit", "pricing", "calculator"],
    icon: "Percent",
  },
  {
    id: "4",
    name: "Break-Even Calculator",
    description: "Find your break-even point in units and revenue",
    category: "finance",
    slug: "break-even-calculator",
    keywords: ["break-even", "breakeven", "profit", "costs"],
    icon: "TrendingUp",
  },
  {
    id: "5",
    name: "ROI Calculator",
    description: "Calculate return on investment and payback period",
    category: "finance",
    slug: "roi-calculator",
    keywords: ["roi", "return", "investment", "profit"],
    icon: "PiggyBank",
  },
  {
    id: "6",
    name: "Pricing Calculator",
    description: "Calculate optimal selling prices from costs and margins",
    category: "finance",
    slug: "pricing-calculator",
    keywords: ["pricing", "price", "margin", "selling"],
    icon: "Tag",
  },
  {
    id: "7",
    name: "VAT Calculator",
    description: "Add or remove VAT from any amount with EU rates",
    category: "finance",
    slug: "vat-calculator",
    keywords: ["vat", "tax", "eu", "europe", "gst"],
    icon: "Calculator",
  },
  {
    id: "8",
    name: "Cash Flow Forecast",
    description: "Project your business cash flow and runway",
    category: "finance",
    slug: "cash-flow-forecast",
    keywords: ["cash", "flow", "forecast", "runway", "projection"],
    icon: "LineChart",
  },

  // HR
  {
    id: "9",
    name: "Headcount Cost Calculator",
    description: "Calculate true employee costs including taxes and benefits",
    category: "hr",
    slug: "headcount-cost-calculator",
    keywords: ["headcount", "employee", "salary", "cost", "hiring"],
    icon: "Users",
  },
  {
    id: "10",
    name: "Meeting Cost Calculator",
    description: "Calculate how much your meetings really cost",
    category: "hr",
    slug: "meeting-cost-calculator",
    keywords: ["meeting", "cost", "time", "productivity"],
    icon: "Clock",
  },

  // PDFs — "to PDF"
  {
    id: "11",
    name: "Images to PDF",
    description: "Convert JPG, PNG, WebP, HEIC, or TIFF images to PDF",
    category: "pdfs",
    slug: "images-to-pdf",
    keywords: ["image", "jpg", "png", "webp", "heic", "tiff", "pdf", "convert"],
    icon: "Image",
  },
  {
    id: "12",
    name: "Word to PDF",
    description: "Convert DOC and DOCX Word documents to PDF",
    category: "pdfs",
    slug: "word-to-pdf",
    keywords: ["word", "doc", "docx", "pdf", "convert", "document"],
    icon: "FileType",
  },
  {
    id: "13",
    name: "PowerPoint to PDF",
    description: "Convert PPT and PPTX presentations to PDF",
    category: "pdfs",
    slug: "powerpoint-to-pdf",
    keywords: ["powerpoint", "ppt", "pptx", "pdf", "convert", "presentation", "slides"],
    icon: "Presentation",
  },
  {
    id: "14",
    name: "Excel to PDF",
    description: "Convert XLS, XLSX, and CSV spreadsheets to PDF",
    category: "pdfs",
    slug: "excel-to-pdf",
    keywords: ["excel", "xls", "xlsx", "csv", "pdf", "convert", "spreadsheet"],
    icon: "Table",
  },
  {
    id: "15",
    name: "Text to PDF",
    description: "Convert TXT, Markdown, or HTML files to PDF",
    category: "pdfs",
    slug: "text-to-pdf",
    keywords: ["text", "txt", "markdown", "md", "html", "pdf", "convert"],
    icon: "FileCode",
  },
  {
    id: "16",
    name: "E-book to PDF",
    description: "Convert EPUB and MOBI e-books to PDF",
    category: "pdfs",
    slug: "ebook-to-pdf",
    keywords: ["ebook", "epub", "mobi", "kindle", "pdf", "convert", "book"],
    icon: "BookOpen",
  },

  // PDFs — other tools
  {
    id: "17",
    name: "Scan to PDF",
    description: "Auto-clean and convert scanned images to professional PDFs",
    category: "pdfs",
    slug: "scan-to-pdf",
    keywords: ["scan", "scanner", "clean", "document", "pdf", "ocr", "image"],
    icon: "ScanLine",
  },
  {
    id: "33",
    name: "Organize PDF",
    description: "Reorder, rotate, or delete pages in your PDF — client-side",
    category: "pdfs",
    slug: "organize-pdf",
    keywords: ["organize", "pdf", "reorder", "rotate", "delete", "pages", "rearrange"],
    icon: "Layers",
  },
  {
    id: "28",
    name: "Merge PDFs",
    description: "Combine multiple PDF files into one — client-side",
    category: "pdfs",
    slug: "merge-pdfs",
    keywords: ["merge", "pdf", "combine", "join"],
    icon: "Merge",
  },

  // PDFs — "PDF to ..."
  {
    id: "18",
    name: "PDF to Images",
    description: "Convert PDF pages to JPG, PNG, or WebP images",
    category: "pdfs",
    slug: "pdf-to-images",
    keywords: ["pdf", "jpg", "png", "webp", "image", "convert", "extract"],
    icon: "Image",
  },
  {
    id: "19",
    name: "PDF to Word",
    description: "Convert PDF documents to editable DOCX files",
    category: "pdfs",
    slug: "pdf-to-word",
    keywords: ["pdf", "word", "docx", "doc", "convert", "editable"],
    icon: "FileType",
  },
  {
    id: "20",
    name: "PDF to PowerPoint",
    description: "Convert PDF files to editable PPTX presentations",
    category: "pdfs",
    slug: "pdf-to-powerpoint",
    keywords: ["pdf", "powerpoint", "pptx", "ppt", "presentation", "slides", "convert"],
    icon: "Presentation",
  },
  {
    id: "21",
    name: "PDF to Excel",
    description: "Extract tables from PDF to XLSX spreadsheets",
    category: "pdfs",
    slug: "pdf-to-excel",
    keywords: ["pdf", "excel", "xlsx", "xls", "table", "spreadsheet", "extract"],
    icon: "Table",
  },
  {
    id: "22",
    name: "PDF to CSV",
    description: "Extract tables from PDF to CSV format",
    category: "pdfs",
    slug: "pdf-to-csv",
    keywords: ["pdf", "csv", "table", "data", "extract", "spreadsheet"],
    icon: "FileSpreadsheet",
  },
  {
    id: "23",
    name: "PDF to Text",
    description: "Extract plain text content from PDF files",
    category: "pdfs",
    slug: "pdf-to-text",
    keywords: ["pdf", "text", "txt", "extract", "plain", "content"],
    icon: "FileText",
  },
  {
    id: "24",
    name: "PDF to HTML",
    description: "Convert PDF documents to HTML web pages",
    category: "pdfs",
    slug: "pdf-to-html",
    keywords: ["pdf", "html", "web", "convert", "webpage"],
    icon: "Code",
  },
  {
    id: "25",
    name: "PDF to EPUB",
    description: "Convert PDF documents to EPUB e-book format",
    category: "pdfs",
    slug: "pdf-to-epub",
    keywords: ["pdf", "epub", "ebook", "kindle", "convert", "book"],
    icon: "BookOpen",
  },
  {
    id: "26",
    name: "PDF to SVG",
    description: "Convert PDF pages to scalable SVG vector graphics",
    category: "pdfs",
    slug: "pdf-to-svg",
    keywords: ["pdf", "svg", "vector", "scalable", "graphics", "convert"],
    icon: "Shapes",
  },
  {
    id: "27",
    name: "PDF OCR",
    description: "Make scanned PDFs searchable with OCR text recognition",
    category: "pdfs",
    slug: "pdf-ocr",
    keywords: ["pdf", "ocr", "searchable", "scan", "text", "recognition"],
    icon: "ScanSearch",
  },

  // Files — consolidated pages (instead of many tiny tool pages)
  {
    id: "28",
    name: "Zip Tools",
    description: "Create ZIP files or extract ZIP archives — client-side",
    category: "files",
    slug: "zip-tools",
    keywords: ["zip", "extract", "archive", "compress"],
    icon: "FileArchive",
  },
  {
    id: "29",
    name: "Minify & Prettify",
    description: "JSON prettifier + HTML/CSS/JS minifiers — client-side",
    category: "files",
    slug: "minify-prettify",
    keywords: ["json", "prettify", "minify", "css", "js", "html"],
    icon: "Code",
  },
  {
    id: "30",
    name: "Image Converter",
    description: "Convert JPG/PNG/WebP/AVIF images — client-side",
    category: "files",
    slug: "image-converter",
    keywords: ["image", "convert", "jpg", "jpeg", "png", "webp", "avif"],
    icon: "Image",
  },
  {
    id: "31",
    name: "Image Compressor",
    description: "Compress images for email, Instagram, LinkedIn, and web — client-side",
    category: "files",
    slug: "image-compressor",
    keywords: ["image", "compress", "email", "instagram", "linkedin", "webp", "jpg", "png"],
    icon: "Wand2",
  },

  {
    id: "32",
    name: "Compress PDF",
    description:
      "Compress PDFs locally in your browser — Safe Optimize or Strong Compress with DPI + quality controls.",
    category: "pdfs",
    slug: "compress-pdf",
    keywords: ["compress pdf", "reduce pdf size", "pdf optimizer", "pdf shrink", "pdf compressor", "flatten pdf"],
    icon: "FileText",
  },

  {
    id: "34",
    name: "Split PDF",
    description: "Split, extract, or chunk pages from a PDF — client-side, fast, private.",
    category: "pdfs",
    slug: "split-pdf",
    keywords: ["split pdf", "extract pdf pages", "pdf page range", "separate pdf", "chunk pdf"],
    icon: "Scissors",
  },
];

export const categories = [
  { id: "communication", name: "Communication", description: "Email, messaging, and professional communication tools" },
  { id: "finance", name: "Finance & Pricing", description: "Calculators for margins, pricing, VAT, and cash flow" },
  { id: "operations", name: "Operations", description: "Tools for day-to-day business operations" },
  { id: "hr", name: "HR & Costs", description: "Employee costs, meetings, and workforce tools" },
  { id: "pdfs", name: "PDFs", description: "Convert documents, images, and files to PDF" },
  {
    id: "files",
    name: "Compress & Optimize",
    description: "Compress Optimize Tools, image compression, and code minifiers",
  },
];

export function searchTools(query: string): Tool[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return tools;

  return tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.keywords.some((k) => k.includes(lowerQuery)) ||
      tool.category.includes(lowerQuery),
  );
}

export function getToolsByCategory(category: string): Tool[] {
  return tools.filter((tool) => tool.category === category);
}

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug);
}
