import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Code, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Create a simple “web page” HTML from PDF selectable text.
 * This is the best free client-side approach without heavy layout engines.
 */
export default function PDFToHTML() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [mode, setMode] = useState<"readable" | "pre">("readable");
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
        setPdfFile({ file, name: file.name });
        setProgress(null);
      } else {
        toast({
          title: "Only PDFs supported",
          description: "Please upload a .pdf file.",
          variant: "destructive",
        });
      }
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

  const convertToHTML = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const pageBlocks: string[] = [];

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const strings = (textContent.items as any[])
          .map((it) => (typeof it.str === "string" ? it.str : ""))
          .filter(Boolean);

        // “Readable” mode: collapse whitespace
        const pageText = strings.join(" ").replace(/\s+/g, " ").trim();

        if (mode === "pre") {
          // preserve “line-ish” breaks by rough y-grouping (still imperfect)
          const items = (textContent.items as any[]).map((it) => ({
            str: String(it.str || ""),
            x: it.transform?.[4] ?? 0,
            y: it.transform?.[5] ?? 0,
          }));

          const lineMap = new Map<number, { x: number; str: string }[]>();
          for (const it of items) {
            const yKey = Math.round(it.y);
            if (!lineMap.has(yKey)) lineMap.set(yKey, []);
            lineMap.get(yKey)!.push({ x: it.x, str: it.str });
          }

          const yKeys = Array.from(lineMap.keys()).sort((a, b) => b - a);
          const lines = yKeys.map((y) => {
            const parts = lineMap.get(y)!.sort((a, b) => a.x - b.x);
            return parts
              .map((p) => p.str)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
          });

          pageBlocks.push(`
            <section class="page">
              <h2>Page ${pageNumber}</h2>
              <pre>${escapeHtml(lines.filter(Boolean).join("\n"))}</pre>
            </section>
          `);
        } else {
          pageBlocks.push(`
            <section class="page">
              <h2>Page ${pageNumber}</h2>
              <p>${escapeHtml(pageText || "(No selectable text found on this page.)")}</p>
            </section>
          `);
        }
      }

      const title = baseName(pdfFile.name);

      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; line-height: 1.55; }
    .container { max-width: 900px; margin: 0 auto; }
    header { margin-bottom: 24px; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    .meta { font-size: 13px; opacity: 0.75; }
    .page { border: 1px solid rgba(127,127,127,0.25); border-radius: 12px; padding: 16px; margin: 16px 0; }
    .page h2 { font-size: 16px; margin: 0 0 10px; opacity: 0.85; }
    p { margin: 0; white-space: pre-wrap; }
    pre { margin: 0; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
    .note { margin-top: 10px; font-size: 13px; opacity: 0.75; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Converted from PDF to HTML (text-based). Layout/images/tables may not match the original.</div>
      <div class="note">Tip: If this is a scanned PDF, run OCR first.</div>
    </header>
    ${pageBlocks.join("\n")}
  </div>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      saveAs(blob, `${title}.html`);

      toast({
        title: "Done!",
        description: "Downloaded an HTML file.",
      });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to HTML.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF to HTML (Text-based)"
      description="Convert PDF selectable text into a simple HTML page — free and client-side."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
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
                  <Code className="h-8 w-8 text-primary shrink-0" />
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

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Output style</p>
                <p className="text-xs text-muted-foreground">
                  Readable is best for web pages; Pre keeps more line breaks.
                </p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as "readable" | "pre")}
                disabled={converting}
              >
                <option value="readable">Readable</option>
                <option value="pre">Preserve lines (best effort)</option>
              </select>
            </div>
          </Card>

          <Button onClick={convertToHTML} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload your PDF file</span>
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
                <span>Download a simple HTML page</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• This is text-based HTML (best free option)</li>
              <li>• Images, complex layout, and tables won’t match perfectly</li>
              <li>• For scanned PDFs, run PDF OCR first</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
