import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileImage, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

// pdfjs-dist (PDF.js)
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFFile {
  file: File;
  name: string;
}

type OutputFormat = "png" | "jpeg" | "webp";

export default function PDFToImages() {
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [converting, setConverting] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [scale, setScale] = useState<number>(2); // 1 = low, 2 = good, 3 = high
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

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

  const extForFormat = (f: OutputFormat) => (f === "jpeg" ? "jpg" : f);
  const mimeForFormat = (f: OutputFormat) => (f === "png" ? "image/png" : f === "jpeg" ? "image/jpeg" : "image/webp");

  const convertToImages = async () => {
    if (!pdfFile) return;

    setConverting(true);
    setProgress(null);

    try {
      const arrayBuffer = await pdfFile.file.arrayBuffer();
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages: number = pdf.numPages;
      setProgress({ current: 0, total: totalPages });

      const zip = new JSZip();
      const baseName = pdfFile.name.replace(/\.pdf$/i, "") || "pdf";

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        setProgress({ current: pageNumber, total: totalPages });

        const page = await pdf.getPage(pageNumber);

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) throw new Error("Could not create canvas context.");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        // Convert canvas to blob
        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Failed to export image."))),
            mimeForFormat(format),
            format === "jpeg" ? 0.92 : undefined,
          );
        });

        const fileName = `${baseName}-page-${String(pageNumber).padStart(3, "0")}.${extForFormat(format)}`;
        zip.file(fileName, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-images.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({
        title: "Done!",
        description: `Converted ${totalPages} page(s) and downloaded a ZIP.`,
      });
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
    <ToolLayout title="PDF to Images" description="Convert PDF pages to JPG, PNG, or WebP images">
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
                  <FileImage className="h-8 w-8 text-primary shrink-0" />
                  <span className="font-medium truncate">{pdfFile.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Options */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Output format</p>
                <p className="text-xs text-muted-foreground">Choose how each page is exported.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                disabled={converting}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPG</option>
                <option value="webp">WebP</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Quality / scale</p>
                <p className="text-xs text-muted-foreground">Higher = larger images + slower.</p>
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={String(scale)}
                onChange={(e) => setScale(Number(e.target.value))}
                disabled={converting}
              >
                <option value="1">Low (1x)</option>
                <option value="2">Good (2x)</option>
                <option value="3">High (3x)</option>
              </select>
            </div>

            {progress && (
              <div className="text-xs text-muted-foreground">
                Converting page {progress.current} / {progress.total}…
              </div>
            )}
          </Card>

          <Button onClick={convertToImages} disabled={!pdfFile || converting} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Convert to Images (ZIP)
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
                <span>Select output format and quality</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download all pages as images in a ZIP</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• High-quality image output</li>
              <li>• PNG / JPG / WebP</li>
              <li>• Batch download as ZIP</li>
              <li>• Private: runs in your browser</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
