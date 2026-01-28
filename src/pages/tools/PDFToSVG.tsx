import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Shapes, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";
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
function escapeXml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Canvas -> PNG base64 (no prefix)
function canvasToPngBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1] || "";
}
export default function PDFToSVG() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Options
  const [scale, setScale] = useState<number>(2); // higher = sharper, larger files
  const [zipMode, setZipMode] = useState<"zip" | "single">("zip"); // single only if 1 page
  const { toast } = useToast();
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
        setPdfFile({
          file,
          name: file.name,
        });
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
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });
  const clearFile = () => {
    setPdfFile(null);
    setProgress(null);
  };
  const convertToSVG = async () => {
    if (!pdfFile) return;
    setConverting(true);
    setProgress(null);
    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({
        data: arrayBuffer,
      });
      const pdf = await loadingTask.promise;
      const totalPages: number = pdf.numPages;
      setProgress({
        current: 0,
        total: totalPages,
      });
      const base = baseName(pdfFile.name);
      const zip = new JSZip();
      let singleSvg: string | null = null;
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({
          current: pageNumber,
          total: totalPages,
        });
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({
          scale,
        });

        // Render page to canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        // Create an SVG that embeds the rendered PNG
        const pngBase64 = canvasToPngBase64(canvas);
        const width = canvas.width;
        const height = canvas.height;
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${escapeXml(base)} — Page ${pageNumber}</title>
  <image x="0" y="0" width="${width}" height="${height}"
         xlink:href="data:image/png;base64,${pngBase64}" />
</svg>`;
        if (totalPages === 1 && zipMode === "single") {
          singleSvg = svg;
        } else {
          zip.file(`${base}-page-${String(pageNumber).padStart(3, "0")}.svg`, svg);
        }
      }
      if (totalPages === 1 && zipMode === "single" && singleSvg) {
        const blob = new Blob([singleSvg], {
          type: "image/svg+xml;charset=utf-8",
        });
        saveAs(blob, `${base}.svg`);
        toast({
          title: "Done!",
          description: "Downloaded SVG file.",
        });
      } else {
        const zipBlob = await zip.generateAsync({
          type: "blob",
        });
        saveAs(zipBlob, `${base}-svg.zip`);
        toast({
          title: "Done!",
          description: `Downloaded a ZIP with ${totalPages} SVG file(s).`,
        });
      }
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to SVG.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };
  return (
    <ToolLayout
      title="PDF to SVG (Image-based)"
      description="Convert each PDF page into an SVG that contains a high-resolution embedded image."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
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
                  <Shapes className="h-8 w-8 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdfFile.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {progress && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Rendering page {progress.current} / {progress.total}…
                </div>
              )}
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Quality / scale</p>
                <p className="text-xs text-muted-foreground">Higher = sharper SVGs, larger files.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={String(scale)}
                onChange={(e) => setScale(Number(e.target.value))}
                disabled={converting}
              >
                <option value="1">Fast (1x)</option>
                <option value="2">Balanced (2x)</option>
                <option value="3">High (3x)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Download</p>
                <p className="text-xs text-muted-foreground">ZIP for multi-page PDFs.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={zipMode}
                onChange={(e) => setZipMode(e.target.value as "zip" | "single")}
                disabled={converting}
              >
                <option value="zip">ZIP (one SVG per page)</option>
                <option value="single">Single SVG (only if 1 page)</option>
              </select>
            </div>
          </Card>

          <Button onClick={convertToSVG} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download SVG
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
                <span>Each page is rendered to a high-resolution image</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>We wrap the image inside an SVG and download the files</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Output is SVG, but content is image-based</li>
              <li>• For true editable vectors (paths/text), you’ll need backend conversion</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
