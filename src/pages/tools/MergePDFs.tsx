import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, ArrowUp, ArrowDown, Layers, Loader2, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";

interface PDFItem {
  id: string;
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

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function MergePDFs() {
  const [items, setItems] = useState<PDFItem[]>([]);
  const [merging, setMerging] = useState(false);
  const { toast } = useToast();

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.size, 0), [items]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const pdfs = acceptedFiles.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));

      if (pdfs.length === 0) {
        toast({
          title: "Only PDFs supported",
          description: "Please upload one or more .pdf files.",
          variant: "destructive",
        });
        return;
      }

      const newItems: PDFItem[] = pdfs.map((file) => ({
        id: safeId(),
        file,
        name: file.name,
        size: file.size,
      }));

      setItems((prev) => [...prev, ...newItems]);
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 50,
  });

  const removeItem = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const clearAll = () => setItems([]);

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const mergeNow = async () => {
    if (items.length < 2) {
      toast({
        title: "Add at least 2 PDFs",
        description: "Upload two or more PDF files to merge them into one.",
        variant: "destructive",
      });
      return;
    }

    setMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of items) {
        const bytes = await item.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const filename = `merged-${new Date().toISOString().slice(0, 10)}.pdf`;

      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({
        title: "Merged!",
        description: "Your merged PDF has been downloaded.",
      });
    } catch (e: any) {
      toast({
        title: "Merge failed",
        description: e?.message ? String(e.message) : "Something went wrong while merging your PDFs.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <ToolLayout
      title="Merge PDFs"
      description="Combine multiple PDF files into a single PDF — fast, private, and client-side."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Upload + List + CTA */}
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
              <p className="text-lg font-medium">Drop PDFs here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Add multiple files. Reorder before merging.</p>
            </div>
          </Card>

          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{items.length}</span> file
                  {items.length === 1 ? "" : "s"} •{" "}
                  <span className="font-medium text-foreground">{formatBytes(totalSize)}</span>
                </div>
                <Button variant="ghost" onClick={clearAll} className="h-8 px-2">
                  Clear
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">{formatBytes(it.size)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0 || merging}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => move(idx, 1)}
                        disabled={idx === items.length - 1 || merging}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(it.id)}
                        disabled={merging}
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={mergeNow} disabled={items.length < 2 || merging} className="w-full" size="lg">
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 mr-2" />
                Merge PDFs
              </>
            )}
          </Button>
        </div>

        {/* Right: How it works + Features */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload 2+ PDF files</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Reorder the files (optional)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Merge and download the combined PDF</span>
              </li>
            </ol>

            <div className="mt-5 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Download className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  Everything runs in your browser. Your PDFs are not uploaded anywhere (unless you later add a backend).
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Merge unlimited pages (practical limit depends on your device)</li>
              <li>• Drag & drop upload</li>
              <li>• Reorder files before merging</li>
              <li>• Private: client-side processing</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
