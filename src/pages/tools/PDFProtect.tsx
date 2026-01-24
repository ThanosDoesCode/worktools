import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Lock, Download, FileText, Shield, Eye, EyeOff, Loader2, Unlock, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/layout/ToolLayout";

type Mode = "protect" | "unlock";
type PrintLevel = "full" | "low" | "none";
type ModifyLevel = "all" | "annotate" | "form" | "assembly" | "none";

function scorePassword(pw: string) {
  const p = pw || "";
  let score = 0;

  if (p.length >= 8) score += 1;
  if (p.length >= 12) score += 1;
  if (/[A-Z]/.test(p)) score += 1;
  if (/[a-z]/.test(p)) score += 1;
  if (/\d/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p)) score += 1;

  if (score <= 2) return { level: 1, label: "Weak" };
  if (score <= 4) return { level: 2, label: "OK" };
  if (score === 5) return { level: 3, label: "Strong" };
  return { level: 4, label: "Very strong" };
}

function generatePassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{};:,.?";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function baseName(name: string) {
  return (name || "document").replace(/\.pdf$/i, "") || "document";
}

const PDFProtect: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  const [mode, setMode] = useState<Mode>("protect");

  // Protect mode
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [useSameOwnerPassword, setUseSameOwnerPassword] = useState(true);

  // Unlock mode
  const [unlockPassword, setUnlockPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  // Permissions UI (NOTE: qpdf-wasm supports richer permission flags, but we keep UI now and can wire them next)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [printLevel, setPrintLevel] = useState<PrintLevel>("full");
  const [modifyLevel, setModifyLevel] = useState<ModifyLevel>("all");
  const [allowExtract, setAllowExtract] = useState(true);
  const [allowAnnotate, setAllowAnnotate] = useState(true);
  const [allowAssemble, setAllowAssemble] = useState(true);
  const [allowFormFill, setAllowFormFill] = useState(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState<string>("");

  // QPDF WASM module (load once)
  const qpdfRef = useRef<any | null>(null);
  const [qpdfReady, setQpdfReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [{ default: createModule }, wasmModule] = await Promise.all([
          import("@neslinesli93/qpdf-wasm"),
          import("@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url"),
        ]);

        const qpdf = await createModule({
          locateFile: () => wasmModule.default,
          noInitialRun: true,
        });

        if (!mounted) return;
        qpdfRef.current = qpdf;
        setQpdfReady(true);
      } catch (e) {
        if (!mounted) return;
        setQpdfReady(false);
        toast.error("Failed to load PDF engine (QPDF). Check dependencies/build config.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordMinOk = password.length >= 4;
  const strongEnough = password.length >= 8 && strength.level >= 2;

  const canProtect =
    !!file &&
    qpdfReady &&
    !isProcessing &&
    passwordMinOk &&
    passwordsMatch &&
    (useSameOwnerPassword || ownerPassword.trim().length > 0) &&
    strongEnough;

  const canUnlock = !!file && qpdfReady && !isProcessing && unlockPassword.trim().length > 0;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));

    if (pdfFile) {
      setFile(pdfFile);
      setOutputBlob(null);
      setOutputName("");
      setProgress(0);
      toast.success("PDF loaded.");
    } else {
      toast.error("Please upload a PDF file.");
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
    setConfirmPassword("");
    setOwnerPassword("");
    setUseSameOwnerPassword(true);
    setUnlockPassword("");
    setOutputBlob(null);
    setOutputName("");
    setProgress(0);
    setIsProcessing(false);
    setShowPassword(false);
  };

  // NOTE: Permission flags are shown in UI but not applied yet in the qpdf call.
  // We will wire them next once we confirm qpdf is working end-to-end in your build.
  const handleProcess = async () => {
    if (!file) {
      toast.error("Please upload a PDF file first.");
      return;
    }
    if (!qpdfReady || !qpdfRef.current) {
      toast.error("PDF engine is still loading. Try again in a moment.");
      return;
    }

    if (mode === "protect" && !canProtect) {
      toast.error("Check password rules and try again.");
      return;
    }
    if (mode === "unlock" && !canUnlock) {
      toast.error("Enter the current password to unlock.");
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      const qpdf = qpdfRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FS = (qpdf as any).FS;

      // cleanup old files
      try {
        FS.unlink("input.pdf");
      } catch {}
      try {
        FS.unlink("output.pdf");
      } catch {}

      setProgress(25);

      const arrayBuffer = await file.arrayBuffer();
      const inputBytes = new Uint8Array(arrayBuffer);
      FS.writeFile("input.pdf", inputBytes);

      setProgress(55);

      if (mode === "protect") {
        const userPw = password;
        const ownerPw = useSameOwnerPassword ? password : ownerPassword;

        // Encrypt with AES-256
        qpdf.callMain(["--encrypt", userPw, ownerPw, "256", "--", "input.pdf", "output.pdf"]);
      } else {
        // Decrypt (requires current password)
        qpdf.callMain([`--password=${unlockPassword}`, "--decrypt", "--", "input.pdf", "output.pdf"]);
      }

      setProgress(85);

      const outBytes = FS.readFile("output.pdf");
      const blob = new Blob([new Uint8Array(outBytes)], { type: "application/pdf" });

      const name = mode === "protect" ? `${baseName(file.name)}_protected.pdf` : `${baseName(file.name)}_unlocked.pdf`;

      setOutputBlob(blob);
      setOutputName(name);

      setProgress(100);
      toast.success(mode === "protect" ? "PDF protected successfully!" : "PDF unlocked successfully!");
    } catch (error: any) {
      console.error("PDF processing failed:", error);
      toast.error(
        mode === "protect"
          ? "Failed to protect PDF. Please try again."
          : "Failed to unlock PDF. Password may be wrong or PDF may be unsupported.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputName || "output.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded!");
  };

  return (
    <ToolLayout
      title="PDF Protect"
      description="Password-protect (AES-256) a PDF — or remove a password if you know it. Everything runs in your browser."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left column */}
        <div className="space-y-6">
          {/* File Upload */}
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
                    <p className="text-xs text-muted-foreground mt-2">
                      {qpdfReady ? "Encryption engine loaded" : "Loading encryption engine…"}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      {isDragActive ? "Drop your PDF here..." : "Drag & drop a PDF file here"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      {qpdfReady ? "Encryption engine loaded" : "Loading encryption engine…"}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mode */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="protect">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" /> Protect (add password)
                      </div>
                    </SelectItem>
                    <SelectItem value="unlock">
                      <div className="flex items-center gap-2">
                        <Unlock className="w-4 h-4" /> Unlock (remove password)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Unlock only works if you know the current password.</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Advanced permissions
                  </Label>
                  <p className="text-xs text-muted-foreground">Printing, editing, extraction, etc.</p>
                </div>
                <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} disabled={mode !== "protect"} />
              </div>

              {mode === "protect" && showAdvanced && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <div className="font-medium">Permissions (UI)</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Printing</Label>
                      <Select value={printLevel} onValueChange={(v) => setPrintLevel(v as PrintLevel)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full</SelectItem>
                          <SelectItem value="low">Low-res only</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Modifying</Label>
                      <Select value={modifyLevel} onValueChange={(v) => setModifyLevel(v as ModifyLevel)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All allowed</SelectItem>
                          <SelectItem value="annotate">Only annotate</SelectItem>
                          <SelectItem value="form">Forms only</SelectItem>
                          <SelectItem value="assembly">Assembly only</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow extract</Label>
                        <p className="text-xs text-muted-foreground">Copy text/images</p>
                      </div>
                      <Switch checked={allowExtract} onCheckedChange={setAllowExtract} />
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow annotate</Label>
                        <p className="text-xs text-muted-foreground">Comments/markup</p>
                      </div>
                      <Switch checked={allowAnnotate} onCheckedChange={setAllowAnnotate} />
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow assemble</Label>
                        <p className="text-xs text-muted-foreground">Reorder pages</p>
                      </div>
                      <Switch checked={allowAssemble} onCheckedChange={setAllowAssemble} />
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow form fill</Label>
                        <p className="text-xs text-muted-foreground">Fill form fields</p>
                      </div>
                      <Switch checked={allowFormFill} onCheckedChange={setAllowFormFill} />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Note: Permission restrictions can be ignored by some PDF viewers.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Protect Inputs */}
          {file && !outputBlob && mode === "protect" && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Set Password Protection</h3>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => {
                      const pw = generatePassword(16);
                      setPassword(pw);
                      setConfirmPassword(pw);
                      setShowPassword(true);
                      toast.success("Generated a strong password.");
                    }}
                  >
                    Generate
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Use 8+ characters for better security"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <Progress value={(strength.level / 4) * 100} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Strength: <span className="font-medium text-foreground">{strength.label}</span>
                      </span>
                      <span>{password.length} chars</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Recommendation: 12+ chars with symbols.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                  />

                  {!passwordMinOk && password.length > 0 && (
                    <p className="text-xs text-destructive">Password must be at least 4 characters.</p>
                  )}
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive">Passwords do not match.</p>
                  )}
                  {passwordMinOk && passwordsMatch && password.length > 0 && !strongEnough && (
                    <p className="text-xs text-muted-foreground">
                      Password is valid, but weak. Use 8+ characters for better security.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label>Use same owner password</Label>
                    <p className="text-xs text-muted-foreground">Owner can override restrictions</p>
                  </div>
                  <Switch checked={useSameOwnerPassword} onCheckedChange={setUseSameOwnerPassword} />
                </div>

                {!useSameOwnerPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="ownerPassword">Owner Password</Label>
                    <Input
                      id="ownerPassword"
                      type={showPassword ? "text" : "password"}
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Required if different from user password"
                    />
                  </div>
                )}

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">Encrypting PDF... {progress}%</p>
                  </div>
                )}

                <Button onClick={handleProcess} disabled={!canProtect} className="w-full">
                  <Lock className="w-4 h-4 mr-2" />
                  {isProcessing ? "Protecting..." : "Protect PDF"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Important: if you forget the password, this PDF cannot be opened.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Unlock Inputs */}
          {file && !outputBlob && mode === "unlock" && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Unlock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Unlock PDF</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unlockPassword">Current password</Label>
                  <div className="relative">
                    <Input
                      id="unlockPassword"
                      type={showPassword ? "text" : "password"}
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      placeholder="Enter the current PDF password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Unlock removes encryption so the PDF opens without a password.
                  </p>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">Unlocking PDF... {progress}%</p>
                  </div>
                )}

                <Button onClick={handleProcess} disabled={!canUnlock} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Unlocking...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Unlock PDF
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Output */}
          {outputBlob && file && (
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">{mode === "protect" ? "PDF Protected!" : "PDF Unlocked!"}</h3>
                <p className="text-muted-foreground">
                  {mode === "protect"
                    ? "Your PDF is now password-protected with AES-256 encryption."
                    : "Your PDF is now decrypted and should open without a password."}
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={resetAll}>
                    Process Another
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  Output: <span className="font-medium text-foreground">{outputName}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Upload a PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Choose Protect or Unlock and enter the password</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Process locally and download the new PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Everything runs locally in your browser — your PDF is not uploaded anywhere.</li>
              <li>• Protect uses AES-256 encryption (QPDF).</li>
              <li>• Unlock requires the current password; it cannot bypass unknown passwords.</li>
              <li>• Permission restrictions can be ignored by some PDF viewers.</li>
              <li>• Large PDFs may take longer depending on device memory.</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-2">Password tips</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Use 12+ characters for best security.</li>
              <li>• Mix upper/lowercase, numbers, and symbols.</li>
              <li>• Store it in a password manager — you can’t recover it later.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
};

export default PDFProtect;
