import { useCallback, useMemo, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload,
  X,
  Download,
  FileText,
  Loader2,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Trash2,
  Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFFile {
  file: File;
  name: string;
  size: number;
}

interface PageItem {
  id: string;
  index: number; // original index (0-based)
  rotation: 0 | 90 | 180 | 270;
  deleted: boolean;
  thumbnail?: string;
}

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

async function generateThumbnails(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const thumbnails: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    thumbnails.push(canvas.toDataURL("image/jpeg", 0.7));
  }

  return thumbnails;
}

export default function OrganizePDF() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [working, setWorking] = useState(false);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast({ title: "Only PDFs supported", description: "Upload a .pdf file.", variant: "destructive" });
      return;
    }

    setPdfFile({ file, name: file.name, size: file.size });
    setWorking(true);
    setLoadingThumbnails(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const count = doc.getPageCount();

      const initialPages = Array.from({ length: count }).map((_, i) => ({
        id: safeId(),
        index: i,
        rotation: 0 as const,
        deleted: false,
      }));
      setPages(initialPages);

      // Generate thumbnails in background
      generateThumbnails(file).then((thumbs) => {
        setPages((prev) =>
          prev.map((p, i) => ({ ...p, thumbnail: thumbs[i] }))
        );
        setLoadingThumbnails(false);
      }).catch(() => setLoadingThumbnails(false));

      toast({ title: "Loaded", description: `${count} pages ready to organize.` });
    } catch (e: any) {
      setPdfFile(null);
      setPages([]);
      toast({
        title: "Failed to load PDF",
        description: e?.message ? String(e.message) : "Could not open this PDF.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => {
    setPdfFile(null);
    setPages([]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const t = i + dir;
      if (t < 0 || t >= next.length) return prev;
      const tmp = next[i];
      next[i] = next[t];
      next[t] = tmp;
      return next;
    });
  };

  const rotate = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : p
      )
    );
  };

  const toggleDelete = (id: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, deleted: !p.deleted } : p)));
  };

  const activePages = useMemo(() => pages.filter((p) => !p.deleted), [pages]);

  const canExport = useMemo(() => !!pdfFile && activePages.length > 0 && !working, [pdfFile, activePages.length, working]);

  const exportNow = async () => {
    if (!pdfFile) return;
    if (activePages.length === 0) {
      toast({ title: "No pages left", description: "Undo deletes or re-upload.", variant: "destructive" });
      return;
    }

    setWorking(true);
    try {
      const bytes = await pdfFile.file.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();

      const indices = activePages.map((p) => p.index);
      const copied = await out.copyPages(src, indices);

      copied.forEach((page, i) => {
        const rot = activePages[i].rotation;
        if (rot !== 0) page.setRotation(degrees(rot));
        out.addPage(page);
      });

      const outBytes = await out.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName(pdfFile.name)}-organized.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({ title: "Done!", description: "Organized PDF downloaded." });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ? String(e.message) : "Something went wrong exporting the PDF.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <ToolLayout title="Organize PDF" description="Reorder, rotate, and delete pages — then download a new PDF (client-side).">
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-7 w-7 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(pdfFile.size)} • {pages.length} pages • {activePages.length} kept
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={working}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {pages.length > 0 && (
            <Card className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`relative rounded-lg border p-2 transition-opacity ${p.deleted ? "opacity-40" : ""}`}
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-[3/4] bg-muted rounded overflow-hidden mb-2"
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                    >
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt={`Page ${p.index + 1}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {loadingThumbnails ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          ) : (
                            <Layers className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Page info */}
                    <div className="text-center mb-2">
                      <div className="text-sm font-medium">
                        Page {p.index + 1}
                        {p.deleted && <span className="text-destructive"> (deleted)</span>}
                      </div>
                      {p.rotation !== 0 && (
                        <div className="text-xs text-muted-foreground">{p.rotation}° rotated</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0 || working}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === pages.length - 1 || working}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => rotate(p.id)} disabled={working}>
                        <RotateCw className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleDelete(p.id)} disabled={working}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={exportNow} disabled={!canExport} className="w-full" size="lg">
            {working ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Organized PDF
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">What you can do</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Move pages up/down (reorder)</li>
              <li>• Rotate any page by 90°</li>
              <li>• Delete pages (toggle)</li>
              <li>• Download a cleaned PDF</li>
            </ul>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Privacy</h3>
            <p className="text-sm text-muted-foreground">
              Everything runs in your browser. The PDF is not uploaded anywhere.
            </p>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
