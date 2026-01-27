import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, Unlock, Download, FileText, Shield, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/layout/ToolLayout";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function baseName(name: string) {
  return (name || "document").replace(/\.pdf$/i, "") || "document";
}

export default function PDFUnlock() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState<string>("");
  const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles.find(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfFile) {
      toast.error("Please upload a PDF file.");
      return;
    }

    setFile(pdfFile);
    setOutputBlob(null);
    setOutputName("");
    setProgress(0);
    setPassword("");
    setIsEncrypted(null);

    // Check if the PDF is encrypted
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      
      try {
        await loadingTask.promise;
        setIsEncrypted(false);
        toast.info("This PDF is not password-protected.");
      } catch (err: any) {
        if (err?.name === "PasswordException") {
          setIsEncrypted(true);
        } else {
          toast.error("Could not read PDF file.");
        }
      }
    } catch {
      toast.error("Could not read PDF file.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const resetAll = () => {
    setFile(null);
    setPassword("");
    setOutputBlob(null);
    setOutputName("");
    setProgress(0);
    setIsProcessing(false);
    setShowPassword(false);
    setIsEncrypted(null);
  };

  const handleUnlock = async () => {
    if (!file) return toast.error("Please upload a PDF file first.");
    if (!password.trim()) return toast.error("Please enter the password.");

    setIsProcessing(true);
    setProgress(10);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(20);

      // Try to open with password using pdfjs-dist to decrypt
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        password: password,
      });

      setProgress(40);

      const pdfDoc = await loadingTask.promise;
      setProgress(60);

      // Re-render all pages to a new unprotected PDF
      const newPdfDoc = await PDFDocument.create();
      const pageCount = pdfDoc.numPages;

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        
        // Create canvas to render page
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        // Convert canvas to image and embed in new PDF
        const imgData = canvas.toDataURL("image/png");
        const pngImage = await newPdfDoc.embedPng(imgData);

        // Create page with original dimensions (in points, not pixels)
        const originalViewport = page.getViewport({ scale: 1 });
        const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
        newPage.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: originalViewport.width,
          height: originalViewport.height,
        });

        setProgress(60 + Math.round((i / pageCount) * 30));
      }

      const unlockedBytes = await newPdfDoc.save();
      setProgress(95);

      const blob = new Blob([new Uint8Array(unlockedBytes)], { type: "application/pdf" });
      const name = `${baseName(file.name)}_unlocked.pdf`;

      setOutputBlob(blob);
      setOutputName(name);
      setProgress(100);

      toast.success("PDF unlocked successfully!");
    } catch (err: any) {
      console.error(err);
      if (err?.name === "PasswordException" || err?.message?.includes("password")) {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error(err?.message || "Failed to unlock PDF.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob) return;

    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputName || "unlocked.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded!");
  };

  const canUnlock = !!file && isEncrypted && password.trim().length > 0 && !isProcessing;

  return (
    <ToolLayout
      title="PDF Unlock"
      description="Remove password protection from your PDF. Enter the correct password and download an unprotected copy. Everything runs locally in your browser."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* LEFT */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                {file ? (
                  <div className="space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatMB(file.size)}</p>
                    {isEncrypted === true && (
                      <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
                        <Shield className="w-3 h-3" /> Password-protected
                      </p>
                    )}
                    {isEncrypted === false && (
                      <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                        <Unlock className="w-3 h-3" /> Not encrypted
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      {isDragActive ? "Drop your PDF here..." : "Drag & drop a protected PDF here"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-3">All processing happens locally in your browser</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Not encrypted warning */}
          {file && isEncrypted === false && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-700">Not Password-Protected</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This PDF doesn't appear to be password-protected. You can open it directly without unlocking.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={resetAll}>
                      Upload a different file
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PASSWORD FORM */}
          {file && isEncrypted && !outputBlob && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Unlock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Enter Password to Unlock</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter the PDF password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && canUnlock) handleUnlock();
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button onClick={handleUnlock} disabled={!canUnlock} className="w-full gap-2">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Unlocking...
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4" /> Unlock PDF
                    </>
                  )}
                </Button>

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">Processing...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* RESULT */}
          {outputBlob && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <Unlock className="w-5 h-5" />
                  <h3 className="font-semibold">PDF Unlocked Successfully!</h3>
                </div>

                <p className="text-sm text-muted-foreground">
                  The password protection has been removed. You can now open this PDF without a password.
                </p>

                <div className="flex gap-2">
                  <Button onClick={handleDownload} className="flex-1 gap-2">
                    <Download className="h-4 w-4" /> Download Unlocked PDF
                  </Button>
                  <Button variant="outline" onClick={resetAll}>
                    Start Over
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT - Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">How It Works</h3>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-primary">1.</span>
                  Upload a password-protected PDF
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">2.</span>
                  Enter the correct password
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">3.</span>
                  Download the unlocked PDF
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Security & Privacy</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ All processing happens in your browser</li>
                <li>✓ Your files never leave your device</li>
                <li>✓ Password is not stored or transmitted</li>
                <li>✓ No server uploads required</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Important Notes</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• You must know the correct password</li>
                <li>• This tool cannot crack or bypass passwords</li>
                <li>• Only use on PDFs you have permission to unlock</li>
                <li>• The unlocked PDF is re-rendered as images for compatibility</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
