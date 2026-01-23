import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Presentation, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";

// PDF.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

type SlideSize = "wide" | "standard";

function baseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

// canvas -> dataURL
function canvasToDataUrl(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number) {
  return canvas.toDataURL(type, quality);
}

export default function PDFToPowerPoint() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Options
  const [slideSize, setSlideSize] = useState<SlideSize>("wide"); // 16:9
  const [scale, setScale] = useState<number>(2); // render quality
  const [imageFormat, setImageFormat] = useState<"png" | "jpeg">("png");

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

  const convertToPowerPoint = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const pptx = new PptxGenJS();
      pptx.layout = slideSize === "wide" ? "LAYOUT_WIDE" : "LAYOUT_4X3";

      // Get slide dimensions (in inches) from pptxgen defaults:
      // wide: 13.333 x 7.5, 4x3: 10 x 7.5
      const slideW = slideSize === "wide" ? 13.333 : 10;
      const slideH = 7.5;

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context.");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convert to image (data URL)
        const mime = imageFormat === "png" ? "image/png" : "image/jpeg";
        const dataUrl = canvasToDataUrl(canvas, mime, imageFormat === "jpeg" ? 0.92 : undefined);

        // Add slide and fit image to slide while preserving aspect ratio
        const slide = pptx.addSlide();

        const imgAspect = canvas.width / canvas.height;
        const slideAspect = slideW / slideH;

        let w = slideW,
          h = slideH,
          x = 0,
          y = 0;

        if (imgAspect > slideAspect) {
          // Image wider: fit width
          w = slideW;
          h = w / imgAspect;
          x = 0;
          y = (slideH - h) / 2;
        } else {
          // Image taller: fit height
          h = slideH;
          w = h * imgAspect;
          y = 0;
          x = (slideW - w) / 2;
        }

        slide.addImage({ data: dataUrl, x, y, w, h });
      }

      // Export PPTX
      const blob = await pptx.write({ outputType: "blob" }) as Blob;
      saveAs(blob, `${baseName(pdfFile.name)}.pptx`);

      toast({
        title: "Done!",
        description: `Created ${totalPages} slide(s) and downloaded a PPTX.`,
      });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting your PDF to PPTX.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  return (
    <ToolLayout
      title="PDF to PowerPoint (Slides)"
      description="Convert each PDF page into a PowerPoint slide (as an image) — free and client-side."
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
                  <Presentation className="h-8 w-8 text-primary shrink-0" />
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

          {/* Options */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Slide size</p>
                <p className="text-xs text-muted-foreground">Widescreen is best for most decks.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={slideSize}
                onChange={(e) => setSlideSize(e.target.value as SlideSize)}
                disabled={converting}
              >
                <option value="wide">Widescreen (16:9)</option>
                <option value="standard">Standard (4:3)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Quality / scale</p>
                <p className="text-xs text-muted-foreground">Higher = sharper slides, slower.</p>
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
                <p className="text-sm font-medium">Image format</p>
                <p className="text-xs text-muted-foreground">PNG is lossless; JPG is smaller.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={imageFormat}
                onChange={(e) => setImageFormat(e.target.value as "png" | "jpeg")}
                disabled={converting}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPG</option>
              </select>
            </div>
          </Card>

          <Button onClick={convertToPowerPoint} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PPTX
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
                <span>Each page is rendered as an image</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>We create a PPTX with one slide per page</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Slides are image-based (great for presenting)</li>
              <li>• True “editable elements” needs backend conversion</li>
              <li>• Works fully in your browser (no uploads)</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
