import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileType, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import mammoth from "mammoth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function sanitizeForWinAnsi(input: string) {
  return (
    (input || "")
      // Hyphens & dashes
      .replace(/\u2010|\u2011|\u2012|\u2013|\u2014|\u2212/g, "-")
      // Quotes
      .replace(/\u2018|\u2019|\u201A|\u201B/g, "'")
      .replace(/\u201C|\u201D|\u201E|\u201F/g, '"')
      // Ellipsis
      .replace(/\u2026/g, "...")
      // NBSP
      .replace(/\u00A0/g, " ")
      // Bullets
      .replace(/\u2022/g, "*")
      // Zero-width chars
      .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
      // Fallback: strip any remaining non-WinAnsi characters
      .replace(/[^\x00-\xFF]/g, "")
  );
}

interface DocxFile {
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
  return name.replace(/\.(docx|doc)$/i, "") || "document";
}

// very small text wrapper
function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export default function WordToPDF() {
  const [docx, setDocx] = useState<DocxFile | null>(null);
  const [converting, setConverting] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isDocx =
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith(".docx");

      if (!isDocx) {
        toast({
          title: "DOCX only (for now)",
          description: "Upload a .docx file. Old .doc is not supported client-side.",
          variant: "destructive",
        });
        return;
      }

      setDocx({ file, name: file.name, size: file.size });
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
  });

  const clearFile = () => setDocx(null);

  const canConvert = useMemo(() => !!docx && !converting, [docx, converting]);

  const convertNow = async () => {
    if (!docx) return;
    setConverting(true);

    try {
      const arrayBuffer = await docx.file.arrayBuffer();

      // Extract raw text from DOCX
      const result = await mammoth.extractRawText({ arrayBuffer });
      const raw = (result.value || "").trim();

      if (!raw) {
        toast({
          title: "No text found",
          description: "This DOCX appears empty or contains unsupported content.",
          variant: "destructive",
        });
        setConverting(false);
        return;
      }

      // Make a simple PDF (A4-ish)
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pageWidth = 595.28; // A4 points
      const pageHeight = 841.89;

      const margin = 50;
      const fontSize = 11;
      const lineHeight = 16;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      const paragraphs = raw
        .split(/\n{2,}/g)
        .map((p) => p.replace(/\n/g, " ").trim())
        .filter(Boolean);

      // rough char limit for wrapping
      const maxChars = 92;

      for (const p of paragraphs) {
        const lines = wrapText(p, maxChars);

        // paragraph spacing
        if (y - lineHeight < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }

        for (const line of lines) {
          if (y - lineHeight < margin) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }

          page.drawText(line, {
            x: margin,
            y: y - fontSize,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });

          y -= lineHeight;
        }

        y -= 8; // extra space between paragraphs
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const filename = `${baseName(docx.name)}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({ title: "Converted!", description: "Your PDF has been downloaded." });
    } catch (e: any) {
      toast({
        title: "Conversion failed",
        description: e?.message ? String(e.message) : "Something went wrong while converting DOCX to PDF.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <ToolLayout title="Word to PDF" description="Convert DOCX documents to a clean PDF (client-side, text-focused).">
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
              <p className="text-lg font-medium">Drop your DOCX here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Supports .docx (not .doc)</p>
            </div>
          </Card>

          {docx && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{docx.name}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(docx.size)}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={converting} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          <Button onClick={convertNow} disabled={!canConvert} className="w-full" size="lg">
            {converting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Convert to PDF
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
                <span>Upload a DOCX file</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>We extract the text in your browser</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>We generate and download a PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Best for text documents (letters, essays, CVs)</li>
              <li>• Complex layouts, tables, and images may not match perfectly</li>
              <li>• For perfect conversion you’d use a backend (LibreOffice/CloudConvert/etc.)</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
