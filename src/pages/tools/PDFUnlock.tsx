import React, { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Unlock,
  Download,
  FileText,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Lock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/layout/ToolLayout";

// MOAT
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

// Configure PDF.js worker (Vite-friendly; avoids CDN)
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function baseName(name: string) {
  return (name || "document").replace(/\.pdf$/i, "") || "document";
}

type ImageFormat = "png" | "jpeg";

type Settings = {
  renderScale: 1 | 2 | 3; // higher = sharper, slower
  imageFormat: ImageFormat; // output rendering format
  jpegQuality: number; // 0.6..1.0 used only if jpeg
};

const DEFAULT_SETTINGS: Settings = {
  renderScale: 2,
  imageFormat: "png",
  jpegQuality: 0.92,
};

const RECOMMENDED_PRESETS: Array<{ name: string; settings: Settings }> = [
  { name: "Balanced (recommended)", settings: { ...DEFAULT_SETTINGS, renderScale: 2, imageFormat: "png" } },
  { name: "Fast", settings: { ...DEFAULT_SETTINGS, renderScale: 1, imageFormat: "jpeg", jpegQuality: 0.85 } },
  { name: "High quality", settings: { ...DEFAULT_SETTINGS, renderScale: 3, imageFormat: "png" } },
  {
    name: "Smaller file (JPG)",
    settings: { ...DEFAULT_SETTINGS, renderScale: 2, imageFormat: "jpeg", jpegQuality: 0.85 },
  },
];

async function checkEncrypted(file: File): Promise<boolean | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const task = (pdfjsLib as any).getDocument({ data: arrayBuffer });
    try {
      await task.promise;
      return false;
    } catch (err: any) {
      if (err?.name === "PasswordException") return true;
      return null;
    }
  } catch {
    return null;
  }
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

  // MOAT settings
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const toolSlug = "pdf-unlock";

  const moat = useMoat(settings as Record<string, unknown>, (s) => setSettings(s as Settings), {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({ id: p.name, name: p.name, settings: p.settings })),
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
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

    const encrypted = await checkEncrypted(pdfFile);
    setIsEncrypted(encrypted);

    if (encrypted === false) {
      toast.info("This PDF is not password-protected.");
    } else if (encrypted === true) {
      toast.message("Password-protected PDF detected.");
    } else {
      toast.error("Could not determine if the PDF is encrypted.");
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

  const canUnlock = useMemo(
    () => !!file && isEncrypted === true && password.trim().length > 0 && !isProcessing,
    [file, isEncrypted, password, isProcessing],
  );

  const settingsSummary = useMemo(() => {
    const fmt = settings.imageFormat === "png" ? "PNG" : `JPG (${Math.round(settings.jpegQuality * 100)}%)`;
    return `render ${settings.renderScale}x • ${fmt}`;
  }, [settings]);

  const handleUnlock = async () => {
    if (!file) return toast.error("Please upload a PDF file first.");
    if (!password.trim()) return toast.error("Please enter the password.");
    if (isEncrypted !== true) return toast.error("This PDF doesn't appear to be encrypted.");

    setIsProcessing(true);
    setProgress(10);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(20);

      // Open with password using pdfjs (decrypts in-memory)
      const loadingTask = (pdfjsLib as any).getDocument({
        data: arrayBuffer,
        password: password,
      });

      setProgress(40);
      const pdfDoc = await loadingTask.promise;
      setProgress(55);

      // Re-render all pages to a new unprotected PDF (image-based output)
      const newPdfDoc = await PDFDocument.create();
      const pageCount: number = pdfDoc.numPages;

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdfDoc.getPage(i);

        // Render at chosen scale for sharper output
        const viewportHi = page.getViewport({ scale: settings.renderScale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create canvas context.");

        canvas.width = Math.floor(viewportHi.width);
        canvas.height = Math.floor(viewportHi.height);

        await page.render({ canvasContext: context, viewport: viewportHi }).promise;

        // Convert canvas to image and embed in new PDF
        const mime = settings.imageFormat === "png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mime, settings.imageFormat === "jpeg" ? settings.jpegQuality : undefined);

        const embedded =
          settings.imageFormat === "png" ? await newPdfDoc.embedPng(dataUrl) : await newPdfDoc.embedJpg(dataUrl);

        // Page size: keep original points (scale: 1)
        const viewport = page.getViewport({ scale: 1 });
        const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(embedded, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });

        const pct = 55 + Math.round((i / pageCount) * 40);
        setProgress(pct);
      }

      const unlockedBytes = await newPdfDoc.save();
      setProgress(98);

      const blob = new Blob([new Uint8Array(unlockedBytes)], { type: "application/pdf" });
      const name = `${baseName(file.name)}_unlocked.pdf`;

      setOutputBlob(blob);
      setOutputName(name);
      setProgress(100);

      toast.success("PDF unlocked successfully!");
      moat.recordJob();
    } catch (err: any) {
      console.error(err);
      if (
        err?.name === "PasswordException" ||
        String(err?.message || "")
          .toLowerCase()
          .includes("password")
      ) {
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

  return (
    <ToolLayout
      title="PDF Unlock"
      description="Remove password protection from your PDF. Enter the correct password and download an unprotected copy. Everything runs locally in your browser."
    >
      <div className="grid gap-8 lg:grid-cols-3">
        {/* MOAT */}
        <div className="order-3 lg:order-1 space-y-3">
          <LocalStatusIndicator />

          <PresetsPanel
            userPresets={moat.userPresets}
            recommendedPresets={moat.recommendedPresets}
            isLoading={moat.isLoadingPresets}
            onApply={moat.applyPreset}
            onSave={moat.saveCurrentAsPreset}
            onRename={moat.renamePreset}
            onDelete={moat.deletePreset}
            onTogglePinned={moat.togglePinned}
            onUseLastSettings={moat.useLastSettings}
            onReset={moat.resetToDefaults}
          />

          <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
        </div>

        {/* LEFT */}
        <div className="order-1 lg:order-2 space-y-6">
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
                    <p className="font-medium break-all">{file.name}</p>
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
                    {isEncrypted === null && (
                      <p className="text-xs text-muted-foreground">Could not determine encryption status</p>
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

          {/* Options */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-xs text-muted-foreground">{settingsSummary}</div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Render quality</p>
                  <p className="text-xs text-muted-foreground">Higher = sharper output, slower.</p>
                </div>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={String(settings.renderScale)}
                  onChange={(e) => setSettings((p) => ({ ...p, renderScale: Number(e.target.value) as 1 | 2 | 3 }))}
                  disabled={isProcessing}
                >
                  <option value="1">Fast (1x)</option>
                  <option value="2">Balanced (2x)</option>
                  <option value="3">High (3x)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Output image format</p>
                  <p className="text-xs text-muted-foreground">PNG is crisp; JPG is smaller.</p>
                </div>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={settings.imageFormat}
                  onChange={(e) => setSettings((p) => ({ ...p, imageFormat: e.target.value as ImageFormat }))}
                  disabled={isProcessing}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPG</option>
                </select>
              </div>

              {settings.imageFormat === "jpeg" && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">JPG quality</p>
                    <p className="text-xs text-muted-foreground">Lower = smaller file.</p>
                  </div>
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={String(settings.jpegQuality)}
                    onChange={(e) => setSettings((p) => ({ ...p, jpegQuality: Number(e.target.value) }))}
                    disabled={isProcessing}
                  >
                    <option value="0.75">75%</option>
                    <option value="0.85">85%</option>
                    <option value="0.92">92%</option>
                    <option value="0.98">98%</option>
                  </select>
                </div>
              )}
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
          {file && isEncrypted === true && !outputBlob && (
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
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword((v) => !v)}
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

        {/* RIGHT */}
        <div className="order-2 lg:order-3 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">How It Works</h3>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-primary">1.</span> Upload a password-protected PDF
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">2.</span> Enter the correct password
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">3.</span> Download the unlocked PDF
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
                <li>• Output is image-based (best compatibility)</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="p-6">
              <Link to="/tools/pdf-protect" className="flex items-center gap-3 group">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">PDF Protect</h3>
                  <p className="text-sm text-muted-foreground">Add password protection to PDFs</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
