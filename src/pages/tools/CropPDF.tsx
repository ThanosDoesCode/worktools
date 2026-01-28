import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Crop, Loader2, FileText } from "lucide-react";
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

export default function CropPDF() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [working, setWorking] = useState(false);

  // crop amounts in points (pt). 72pt = 1 inch, ~28.35pt = 1cm
  const [top, setTop] = useState(18);
  const [right, setRight] = useState(18);
  const [bottom, setBottom] = useState(18);
  const [left, setLeft] = useState(18);

  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast({ title: "Only PDFs supported", description: "Upload a .pdf file.", variant: "destructive" });
        return;
      }

      setPdfFile({ file, name: file.name, size: file.size });
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => setPdfFile(null);

  const canCrop = useMemo(() => !!pdfFile && !working, [pdfFile, working]);

  const cropNow = async () => {
    if (!pdfFile) return;
    setWorking(true);

    try {
      const bytes = await pdfFile.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);

      const pages = doc.getPages();

      for (const page of pages) {
        const w = page.getWidth();
        const h = page.getHeight();

        const newX = Math.max(0, left);
        const newY = Math.max(0, bottom);
        const newW = Math.max(1, w - left - right);
        const newH = Math.max(1, h - top - bottom);

        // Apply crop box
        page.setCropBox(newX, newY, newW, newH);
      }

      const outBytes = await doc.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName(pdfFile.name)}-cropped.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({ title: "Done!", description: "Cropped PDF downloaded." });
    } catch (e: any) {
      toast({
        title: "Crop failed",
        description: e?.message ? String(e.message) : "Something went wrong cropping the PDF.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <ToolLayout title="Crop PDF" description="Crop margins on every page and download a new PDF.">
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
                    <div className="text-xs text-muted-foreground">{formatBytes(pdfFile.size)}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={working}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="text-sm text-muted-foreground">
              Units are <b>points</b> (pt). Quick reference: <b>28.35pt ≈ 1cm</b>, <b>72pt = 1 inch</b>.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Top (pt)</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={top}
                  min={0}
                  max={500}
                  onChange={(e) => setTop(Number(e.target.value))}
                  disabled={working}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Right (pt)</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={right}
                  min={0}
                  max={500}
                  onChange={(e) => setRight(Number(e.target.value))}
                  disabled={working}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Bottom (pt)</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={bottom}
                  min={0}
                  max={500}
                  onChange={(e) => setBottom(Number(e.target.value))}
                  disabled={working}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Left (pt)</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={left}
                  min={0}
                  max={500}
                  onChange={(e) => setLeft(Number(e.target.value))}
                  disabled={working}
                />
              </div>
            </div>
          </Card>

          <Button onClick={cropNow} disabled={!canCrop} className="w-full" size="lg">
            {working ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cropping...
              </>
            ) : (
              <>
                <Crop className="h-4 w-4 mr-2" />
                Crop PDF
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• This crops by margins (same crop applied to all pages).</li>
              <li>• “Auto-trim to content” needs heavier logic and preview.</li>
              <li>• Runs fully in-browser (private).</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
