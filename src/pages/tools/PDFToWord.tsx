import { useMemo, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// PDF text extraction (PDF.js)
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

// DOCX generation
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

// MOAT
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

type Settings = {
  // Output content
  includeTitlePage: boolean;
  includePageHeadings: boolean;
  collapseWhitespace: boolean;

  // Chunking
  chunkMaxLen: number; // 400..3000

  // Export naming
  filenameSuffix: string; // e.g. "docx" or "word"
};

const DEFAULT_SETTINGS: Settings = {
  includeTitlePage: true,
  includePageHeadings: true,
  collapseWhitespace: true,
  chunkMaxLen: 1200,
  filenameSuffix: "docx",
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  {
    name: "Readable (recommended)",
    settings: { ...DEFAULT_SETTINGS, collapseWhitespace: true, chunkMaxLen: 1200 },
  },
  {
    name: "More faithful spacing",
    settings: { ...DEFAULT_SETTINGS, collapseWhitespace: false, chunkMaxLen: 1200 },
  },
  {
    name: "No page headings",
    settings: { ...DEFAULT_SETTINGS, includePageHeadings: false },
  },
  {
    name: "Smaller paragraphs",
    settings: { ...DEFAULT_SETTINGS, chunkMaxLen: 700 },
  },
];

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeWhitespace(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function chunkText(text: string, maxLen: number) {
  const chunks: string[] = [];
  let buf = (text || "").trim();
  if (!buf) return chunks;

  const limit = clamp(maxLen, 400, 3000);

  while (buf.length > limit) {
    const cut = buf.lastIndexOf(" ", limit);
    const idx = cut > 200 ? cut : limit;
    chunks.push(buf.slice(0, idx).trim());
    buf = buf.slice(idx).trim();
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export default function PDFToWord() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  // MOAT settings
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "pdf-to-word";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast({
          title: "Only PDFs supported",
          description: "Please upload a .pdf file.",
          variant: "destructive",
        });
        return;
      }

      setPdfFile({ file, name: file.name });
      setProgress(null);
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => {
    setPdfFile(null);
    setProgress(null);
  };

  const settingsSummary = useMemo(() => {
    const title = settings.includeTitlePage ? "title page" : "no title";
    const headings = settings.includePageHeadings ? "page headings" : "no headings";
    const ws = settings.collapseWhitespace ? "collapsed spaces" : "keep spacing";
    return `${title} • ${headings} • ${ws} • chunk ${settings.chunkMaxLen}`;
  }, [settings]);

  const convertToWord = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const children: Paragraph[] = [];

      // Optional title section
      if (settings.includeTitlePage) {
        children.push(
          new Paragraph({
            text: baseName(pdfFile.name),
            heading: HeadingLevel.TITLE,
          }),
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Text-first conversion (runs in your browser). Layout may differ from the original PDF.",
                italics: true,
              }),
            ],
          }),
        );
      }

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const strings = (textContent.items as any[])
          .map((it) => (typeof it.str === "string" ? it.str : ""))
          .filter(Boolean);

        let pageText = strings.join(" ");
        pageText = settings.collapseWhitespace ? normalizeWhitespace(pageText) : pageText.trim();

        if (settings.includePageHeadings) {
          children.push(
            new Paragraph({
              text: `Page ${pageNumber}`,
              heading: HeadingLevel.HEADING_2,
            }),
          );
        }

        if (!pageText) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "(No selectable text found on this page. If this is a scan, use PDF OCR first.)",
                  italics: true,
                }),
              ],
            }),
          );
          continue;
        }

        const chunks = chunkText(pageText, settings.chunkMaxLen);
        for (const chunk of chunks) {
          children.push(new Paragraph({ children: [new TextRun(chunk)] }));
        }
      }

      const doc = new Document({
        sections: [{ properties: {}, children }],
      });

      const blob = await Packer.toBlob(doc);

      const suffix = (settings.filenameSuffix || "docx").trim().replace(/^\./, "") || "docx";
      saveAs(blob, `${baseName(pdfFile.name)}.${suffix}`);

      toast({
        title: "Done!",
        description: "Your DOCX has been downloaded.",
      });

      moat.recordJob();
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF to Word (Text Extract)"
      description="Extract selectable text from a PDF and download an editable DOCX."
    >
      <div className="grid gap-8 lg:grid-cols-3">
        {/* MOAT COLUMN */}
        <div className="order-3 lg:order-1 space-y-3">
          <LocalStatusIndicator />

          <PresetsPanel
            userPresets={moat.userPresets}
            recommendedPresets={moat.recommendedPresets}
            isLoading={moat.isLoadingPresets}
            onApply={moat.applyPreset}
            onSave={moat.saveCurrentAsPreset}
            onRename={moat.renamePreset}
            onDelete={moat.deletePreset}
            onTogglePinned={moat.togglePinned}
            onUseLastSettings={moat.useLastSettings}
            onReset={moat.resetToDefaults}
          />

          <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
        </div>

        {/* LEFT */}
        <div className="order-1 lg:order-2 space-y-6">
          <Card className="p-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          {pdfFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdfFile.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {progress && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Processing page {progress.current} / {progress.total}…
                </div>
              )}
            </Card>
          )}

          {/* Options */}
          <Card className="p-6 space-y-4">
            <div className="text-xs text-muted-foreground">{settingsSummary}</div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Title page</p>
                <p className="text-xs text-muted-foreground">Adds a title + note at the top of the DOCX.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.includeTitlePage ? "on" : "off"}
                onChange={(e) => setSettings((p) => ({ ...p, includeTitlePage: e.target.value === "on" }))}
                disabled={converting}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Page headings</p>
                <p className="text-xs text-muted-foreground">Adds “Page N” headings.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.includePageHeadings ? "on" : "off"}
                onChange={(e) => setSettings((p) => ({ ...p, includePageHeadings: e.target.value === "on" }))}
                disabled={converting}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Whitespace</p>
                <p className="text-xs text-muted-foreground">Collapse spacing for readability.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={settings.collapseWhitespace ? "collapse" : "keep"}
                onChange={(e) => setSettings((p) => ({ ...p, collapseWhitespace: e.target.value === "collapse" }))}
                disabled={converting}
              >
                <option value="collapse">Collapse spaces</option>
                <option value="keep">Keep spacing</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Paragraph chunk size</p>
                <p className="text-xs text-muted-foreground">Smaller chunks = more paragraphs.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={String(settings.chunkMaxLen)}
                onChange={(e) => setSettings((p) => ({ ...p, chunkMaxLen: clamp(Number(e.target.value), 400, 3000) }))}
                disabled={converting}
              >
                <option value="700">Small (700)</option>
                <option value="1200">Normal (1200)</option>
                <option value="1800">Large (1800)</option>
                <option value="2500">Very large (2500)</option>
              </select>
            </div>
          </Card>

          <Button onClick={convertToWord} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download DOCX
              </>
            )}
          </Button>
        </div>

        {/* RIGHT */}
        <div className="order-2 lg:order-3 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload a PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract selectable text page by page</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download an editable DOCX</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Best for PDFs with real text (not scanned images)</li>
              <li>• Layout/tables may not match the original PDF</li>
              <li>• For scanned PDFs, run OCR first</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
