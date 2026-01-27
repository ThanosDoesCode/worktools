import React, { useMemo, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { PDFDocument } from "pdf-lib-with-encrypt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Lock, Download, FileText, Shield, Eye, EyeOff, Loader2, Settings2, Copy } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/layout/ToolLayout";

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

export default function PDFProtect() {
  const [file, setFile] = useState<File | null>(null);

  // Password fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [useSameOwnerPassword, setUseSameOwnerPassword] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  // Advanced permissions
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowModifying, setAllowModifying] = useState(false);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowAnnotating, setAllowAnnotating] = useState(true);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState<string>("");

  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordMinOk = password.length >= 4;
  const strongEnough = password.length >= 8 && strength.level >= 2;

  const canProtect =
    !!file &&
    !isProcessing &&
    passwordMinOk &&
    passwordsMatch &&
    (useSameOwnerPassword || ownerPassword.trim().length > 0) &&
    strongEnough;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles.find((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfFile) {
      toast.error("Please upload a PDF file.");
      return;
    }
    setFile(pdfFile);
    setOutputBlob(null);
    setOutputName("");
    setProgress(0);
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
    setOutputBlob(null);
    setOutputName("");
    setProgress(0);
    setIsProcessing(false);
    setShowPassword(false);
  };

  const handleProcess = async () => {
    if (!file) return toast.error("Please upload a PDF file first.");
    if (!canProtect) return toast.error("Check password rules and try again.");

    setIsProcessing(true);
    setProgress(10);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(25);

      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      setProgress(50);

      const userPw = password;
      const ownerPw = useSameOwnerPassword ? password : ownerPassword;

      // Build permissions object for pdf-lib-with-encrypt
      const permissions: Record<string, boolean> = {};
      
      if (showAdvanced) {
        permissions.printing = allowPrinting;
        permissions.modifying = allowModifying;
        permissions.copying = allowCopying;
        permissions.annotating = allowAnnotating;
      }

      setProgress(70);

      // IMPORTANT: Must call encrypt() BEFORE save() - this is the correct API
      (pdfDoc as any).encrypt({
        userPassword: userPw,
        ownerPassword: ownerPw,
        permissions: showAdvanced ? permissions : undefined,
      });

      // Save without encryption options - encryption was already applied above
      const encryptedPdfBytes = await pdfDoc.save({ useObjectStreams: false });

      setProgress(90);

      const blob = new Blob([new Uint8Array(encryptedPdfBytes)], { type: "application/pdf" });
      const name = `${baseName(file.name)}_protected.pdf`;

      setOutputBlob(blob);
      setOutputName(name);
      setProgress(100);

      toast.success("PDF protected successfully! Recipients will be asked for the password when opening.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to protect PDF. The file may already be encrypted or corrupted.");
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
      description="Password-protect your PDF with AES encryption. Recipients will be prompted to enter the password when opening the file. Everything runs locally in your browser."
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
                    <p className="text-xs text-muted-foreground mt-2">Ready to protect</p>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      {isDragActive ? "Drop your PDF here..." : "Drag & drop a PDF file here"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-3">All processing happens locally in your browser</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Advanced permissions
                  </Label>
                  <p className="text-xs text-muted-foreground">Control printing, editing, copying, etc.</p>
                </div>
                <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
              </div>

              {showAdvanced && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <div className="font-medium">Permissions</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow printing</Label>
                        <p className="text-xs text-muted-foreground">Print the document</p>
                      </div>
                      <Switch checked={allowPrinting} onCheckedChange={setAllowPrinting} />
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow modifying</Label>
                        <p className="text-xs text-muted-foreground">Edit content</p>
                      </div>
                      <Switch checked={allowModifying} onCheckedChange={setAllowModifying} />
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow copying</Label>
                        <p className="text-xs text-muted-foreground">Copy text/images</p>
                      </div>
                      <Switch checked={allowCopying} onCheckedChange={setAllowCopying} />
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label>Allow annotating</Label>
                        <p className="text-xs text-muted-foreground">Add comments</p>
                      </div>
                      <Switch checked={allowAnnotating} onCheckedChange={setAllowAnnotating} />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Note: Permissions are enforced by PDF readers and can be bypassed by some tools.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PASSWORD FORM */}
          {file && !outputBlob && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Set Password Protection</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const pw = generatePassword();
                      setPassword(pw);
                      setConfirmPassword(pw);
                      setShowPassword(true);
                      toast.success("Password generated – copy it before downloading!");
                    }}
                  >
                    Generate
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password (min 8 chars)</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
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
                  {password && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-1.5 w-6 rounded-full transition-colors ${
                              strength.level >= lvl
                                ? lvl <= 2
                                  ? "bg-destructive"
                                  : lvl === 3
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{strength.label}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Same owner password</Label>
                    <p className="text-xs text-muted-foreground">Use the same password for owner access</p>
                  </div>
                  <Switch checked={useSameOwnerPassword} onCheckedChange={setUseSameOwnerPassword} />
                </div>

                {!useSameOwnerPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="ownerPassword">Owner Password</Label>
                    <Input
                      id="ownerPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Owner password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">Owner password allows full access to the PDF.</p>
                  </div>
                )}

                <Button onClick={handleProcess} disabled={!canProtect} className="w-full gap-2">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Protecting...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Protect PDF
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
                  <Shield className="w-5 h-5" />
                  <h3 className="font-semibold">PDF Protected Successfully!</h3>
                </div>

                <p className="text-sm text-muted-foreground">
                  Your PDF is now password-protected. Anyone who opens this file will be prompted to enter the password
                  you set.
                </p>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <code className="flex-1 text-sm font-mono break-all">{password}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(password);
                      toast.success("Password copied to clipboard!");
                    }}
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleDownload} className="flex-1 gap-2">
                    <Download className="h-4 w-4" /> Download Protected PDF
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
                <Lock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">How It Works</h3>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-primary">1.</span>
                  Upload your PDF file
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">2.</span>
                  Set a strong password (at least 8 characters)
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">3.</span>
                  Optionally configure advanced permissions
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">4.</span>
                  Download your protected PDF
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
                <li>✓ Strong AES encryption</li>
                <li>✓ No server uploads required</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Use a mix of uppercase, lowercase, numbers, and symbols</li>
                <li>• Store your password securely – it cannot be recovered</li>
                <li>• Test the protected PDF before sharing</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
