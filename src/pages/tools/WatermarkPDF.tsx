import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Stamp, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

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

export default function WatermarkPDF() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [working, setWorking] = useState(false);

  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.18);
  const [angle, setAngle] = useState(35);
  const [repeat, setRepeat] = useState(false);

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
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const clearFile = () => setPdfFile(null);

  const canRun = useMemo(() => !!pdfFile && text.trim().length > 0 && !working, [pdfFile, text, working]);

  const watermarkNow = async () => {
    if (!pdfFile) return;

    setWorking(true);
    try {
      const bytes = await pdfFile.file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);

      const pages = doc.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();

        if (!repeat) {
          // Single centered watermark
          const tWidth = font.widthOfTextAtSize(text, fontSize);
          const x = (width - tWidth) / 2;
          const y = height / 2;

          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.2, 0.2, 0.2),
            opacity,
            rotate: degrees(angle),
          });
        } else {
          // Repeated tile pattern
          const stepX = Math.max(180, fontSize * 3.2);
          const stepY = Math.max(160, fontSize * 2.8);

          for (let yy = -height; yy < height * 2; yy += stepY) {
            for (let xx = -width; xx < width * 2; xx += stepX) {
              page.drawText(text, {
                x: xx,
                y: yy,
                size: fontSize,
                font,
                color: rgb(0.2, 0.2, 0.2),
                opacity,
                rotate: degrees(angle),
              });
            }
          }
        }
      }

      const outBytes = await doc.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName(pdfFile.name)}-watermarked.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({ title: "Done!", description: "Watermarked PDF downloaded." });
    } catch (e: any) {
      toast({
        title: "Watermark failed",
        description: e?.message ? String(e.message) : "Something went wrong adding the watermark.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <ToolLayout title="Watermark PDF" description="Add a text watermark to every page — client-side, private.">
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
            <div className="space-y-2">
              <div className="text-sm font-medium">Watermark text</div>
              <input
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={working}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Font size</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={fontSize}
                  min={10}
                  max={140}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  disabled={working}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Angle</div>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={angle}
                  min={-90}
                  max={90}
                  onChange={(e) => setAngle(Number(e.target.value))}
                  disabled={working}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Opacity ({opacity.toFixed(2)})</div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.01"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                disabled={working}
                className="w-full"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} disabled={working} />
              Repeat watermark across the page
            </label>
          </Card>

          <Button onClick={watermarkNow} disabled={!canRun} className="w-full" size="lg">
            {working ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Stamp className="h-4 w-4 mr-2" />
                Add Watermark
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Tips</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Use opacity around <b>0.10–0.25</b> for subtle watermarks</li>
              <li>• Use “Repeat” for stronger security-style watermarks</li>
              <li>• Works fully client-side (private)</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
