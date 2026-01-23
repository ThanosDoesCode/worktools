import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, BookOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import jsPDF from "jspdf";
import ePub from "epubjs";
import type { Book } from "epubjs";
type PageSize = "a4" | "letter";

interface UploadFile {
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
  return name.replace(/\.(epub|mobi|azw3)$/i, "") || "ebook";
}

// very simple HTML -> text
function stripHtml(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

export default function EbookToPDF() {
  const [uploaded, setUploaded] = useState<UploadFile | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [fontSize, setFontSize] = useState(11);

  const { toast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isEpub = file.name.toLowerCase().endsWith(".epub");
      if (!isEpub) {
        toast({
          title: "EPUB only (client-side)",
          description: "Upload an .epub file. MOBI/AZW3 needs a backend.",
          variant: "destructive",
        });
        return;
      }

      setUploaded({ file, name: file.name, size: file.size });
      setBook(null);

      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const b = ePub(arrayBuffer);
        await b.ready; // wait for metadata/resources
        setBook(b);

        toast({
          title: "Loaded",
          description: "EPUB loaded. Ready to export to PDF.",
        });
      } catch (e: any) {
        toast({
          title: "Failed to load EPUB",
          description: e?.message ? String(e.message) : "Could not open this EPUB file.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { "application/epub+zip": [".epub"] },
  });

  const clearFile = () => {
    setUploaded(null);
    setBook(null);
  };

  const canExport = useMemo(
    () => !!book && !!uploaded && !loading && !generating,
    [book, uploaded, loading, generating],
  );

  const exportToPDF = async () => {
    if (!book || !uploaded) return;

    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: pageSize });
      const margin = 48;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;

      const lineHeight = fontSize * 1.35;

      doc.setFont("times", "normal");
      doc.setFontSize(fontSize);

      // Title (if available)
      let y = margin;
      const metaTitle = (book.packaging?.metadata as any)?.title || baseName(uploaded.name);
      doc.setFont("times", "bold");
      doc.setFontSize(Math.min(18, fontSize + 6));
      const titleLines = doc.splitTextToSize(String(metaTitle), maxWidth);
      titleLines.forEach((ln: string) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(ln, margin, y);
        y += lineHeight;
      });
      y += lineHeight * 0.5;
      doc.setFont("times", "normal");
      doc.setFontSize(fontSize);

      // Iterate spine (chapters)
      const spine = book.spine as any;
      const spineItems = spine?.items || spine?.spineItems || [];
      if (spineItems.length === 0) {
        throw new Error("No readable chapters found in this EPUB.");
      }

      for (let i = 0; i < spineItems.length; i++) {
        const item = spineItems[i];

        // Load chapter HTML
        const chapter = await book.load(item.href);
        const text = stripHtml(String(chapter));

        if (!text) continue;

        // Chapter separator
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        const paragraphs = text.split(/\n{2,}/g);
        for (const p of paragraphs) {
          const para = p.replace(/\s+/g, " ").trim();
          if (!para) {
            y += lineHeight;
            continue;
          }

          const lines = doc.splitTextToSize(para, maxWidth);
          for (const ln of lines) {
            if (y > pageHeight - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(ln, margin, y);
            y += lineHeight;
          }
          y += lineHeight * 0.35;
        }
      }

      doc.save(`${baseName(uploaded.name)}.pdf`);

      toast({ title: "Exported!", description: "Your PDF has been downloaded." });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ? String(e.message) : "Something went wrong exporting this EPUB to PDF.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ToolLayout title="E-book to PDF" description="Convert EPUB e-books to a clean PDF — client-side, best-effort.">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left */}
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
              <p className="text-lg font-medium">Drop your EPUB here</p>
              <p className="text-sm text-muted-foreground mt-1">EPUB supported (MOBI needs backend)</p>
            </div>
          </Card>

          {uploaded && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{uploaded.name}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(uploaded.size)}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={loading || generating}
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Page size</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as PageSize)}
                  disabled={loading || generating}
                >
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Font size</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={fontSize}
                  min={9}
                  max={18}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  disabled={loading || generating}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Note: This exports text as a readable PDF. Complex layouts, images, and special typography may not be
              preserved.
            </div>
          </Card>

          <Button onClick={exportToPDF} disabled={!canExport} className="w-full" size="lg">
            {loading || generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {loading ? "Loading..." : "Exporting..."}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to PDF
              </>
            )}
          </Button>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload an EPUB file</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract chapters and text</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download a clean multi-page PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Works offline after load</li>
              <li>• Text-based PDF export</li>
              <li>• Adjustable font size</li>
              <li>• No file upload to server</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
