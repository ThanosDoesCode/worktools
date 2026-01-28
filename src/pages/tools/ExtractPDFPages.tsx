import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, Loader2, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";

interface PDFFile {
  file: File;
  name: string;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function baseName(name: string) {
  return (name || "document").replace(/\.pdf$/i, "") || "document";
}

/**
 * Parse page ranges like:
 * "1-3,5,8-10" => [0,1,2,4,7,8,9]
 * Also supports spaces.
 */
function parsePageRange(input: string, pageCount: number): number[] {
  const cleaned = input.replace(/\s+/g, "");
  if (!cleaned) throw new Error("Enter page ranges (e.g. 1-3,5,8-10).");

  const parts = cleaned.split(",");
  const pages = new Set<number>();

  for (const part of parts) {
    if (!part) continue;
    if (part.includes("-")) {
      const [a, b] = part.split("-");
      const start = Number(a);
      const end = Number(b);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1)
        throw new Error(`Invalid range: "${part}"`);
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let p = lo; p <= hi; p++) {
        if (p > pageCount) throw new Error(`Page ${p} exceeds document length (${pageCount}).`);
        pages.add(p - 1);
      }
    } else {
      const p = Number(part);
      if (!Number.isFinite(p) || p < 1) throw new Error(`Invalid page: "${part}"`);
      if (p > pageCount) throw new Error(`Page ${p} exceeds document length (${pageCount}).`);
      pages.add(p - 1);
    }
  }

  const result = Array.from(pages).sort((x, y) => x - y);
  if (result.length === 0) throw new Error("No pages selected.");
  return result;
}

export default function ExtractPDFPages() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [range, setRange] = useState("1");
  const [working, setWorking] = useState(false);

  const { toast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
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

      setPdfFile({ file, name: file.name, size: file.size });
      setWorking(true);
      try {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const count = doc.getPageCount();
        setPageCount(count);
        setRange(`1-${count}`);
        toast({ title: "Loaded", description: `${count} pages detected.` });
      } catch (e: any) {
        setPdfFile(null);
        setPageCount(null);
        toast({
          title: "Failed to read PDF",
          description: e?.message ? String(e.message) : "Could not load this PDF.",
          variant: "destructive",
        });
      } finally {
        setWorking(false);
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
    setPageCount(null);
    setRange("1");
  };

  const canExtract = useMemo(() => !!pdfFile && !!pageCount && !working, [pdfFile, pageCount, working]);

  const extractNow = async () => {
    if (!pdfFile || !pageCount) return;
    setWorking(true);

    try {
      const srcBytes = await pdfFile.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes);

      const indices = parsePageRange(range, pageCount);

      const outDoc = await PDFDocument.create();
      const copied = await outDoc.copyPages(srcDoc, indices);
      copied.forEach((p) => outDoc.addPage(p));

      const outBytes = await outDoc.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName(pdfFile.name)}-extracted.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({ title: "Done!", description: "Extracted PDF downloaded." });
    } catch (e: any) {
      toast({
        title: "Extraction failed",
        description: e?.message ? String(e.message) : "Something went wrong extracting pages.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <ToolLayout title="Extract PDF Pages" description="Pick only the pages you need and download a new PDF — private.">
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
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-7 w-7 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(pdfFile.size)} {pageCount ? `• ${pageCount} pages` : ""}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={working}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pages to extract</label>
                <input
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  disabled={!pageCount || working}
                  placeholder="e.g. 1-3,5,8-10"
                />
                <div className="text-xs text-muted-foreground">
                  Example: <b>1-3,5,8-10</b>
                </div>
              </div>
            </Card>
          )}

          <Button onClick={extractNow} disabled={!canExtract} className="w-full" size="lg">
            {working ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Working...
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4 mr-2" />
                Extract Pages
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload your PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>
                  Type page ranges like <b>1-3,5</b>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a new PDF with only those pages</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Works fully in your browser</li>
              <li>• Supports ranges & single pages</li>
              <li>• Keeps original quality</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
