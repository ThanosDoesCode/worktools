import React, { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, Lock, Download, FileText, Shield, Eye, EyeOff } from "lucide-react";
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

  // normalize to 0..4
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

const PDFProtect: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [protectedBlob, setProtectedBlob] = useState<Blob | null>(null);

  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordMinOk = password.length >= 4;
  const strongEnough = password.length >= 8 && strength.level >= 2;
  const canProtect = !!file && passwordMinOk && passwordsMatch && strongEnough && !isProcessing;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles.find((f) => f.type === "application/pdf");
    if (pdfFile) {
      setFile(pdfFile);
      setProtectedBlob(null);
      setProgress(0);
    } else {
      toast.error("Please upload a PDF file.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const handleProtect = async () => {
    if (!file) {
      toast.error("Please upload a PDF file first.");
      return;
    }
    if (!password) {
      toast.error("Please enter a password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters.");
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      const [{ default: createModule }, wasmModule] = await Promise.all([
        import("@neslinesli93/qpdf-wasm"),
        import("@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url"),
      ]);

      setProgress(30);

      const qpdf = await createModule({
        locateFile: () => wasmModule.default,
      });

      setProgress(50);

      const arrayBuffer = await file.arrayBuffer();
      const inputBytes = new Uint8Array(arrayBuffer);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FS = (qpdf as any).FS;
      FS.writeFile("input.pdf", inputBytes);

      setProgress(70);

      qpdf.callMain(["--encrypt", password, password, "256", "--", "input.pdf", "output.pdf"]);

      setProgress(90);

      const protectedBytes = FS.readFile("output.pdf");
      const blob = new Blob([new Uint8Array(protectedBytes).buffer], {
        type: "application/pdf",
      });

      setProtectedBlob(blob);
      setProgress(100);
      toast.success("PDF protected successfully!");
    } catch (error) {
      console.error("PDF protection failed:", error);
      toast.error("Failed to protect PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!protectedBlob || !file) return;

    const url = URL.createObjectURL(protectedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(".pdf", "_protected.pdf");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Protected PDF downloaded!");
  };

  const handleReset = () => {
    setFile(null);
    setPassword("");
    setConfirmPassword("");
    setProtectedBlob(null);
    setProgress(0);
  };

  return (
    <ToolLayout
      title="PDF Protect"
      description="Add password protection to your PDF files with 256-bit AES encryption. All processing happens in your browser - your files never leave your device."
    >
      <div className="grid lg:grid-cols-2 gap-8">
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
                    <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      {isDragActive ? "Drop your PDF here..." : "Drag & drop a PDF file here"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">or click to browse</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Password Input */}

          {file && !protectedBlob && (
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

                  {/* Strength meter */}
                  <div className="space-y-1">
                    <Progress value={(strength.level / 4) * 100} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Strength: <span className="font-medium text-foreground">{strength.label}</span>
                      </span>
                      <span>{password.length} chars</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommendation: 12+ chars, mix letters, numbers and symbols.
                    </p>
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

                  {/* Inline validation (clean) */}
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

                {isProcessing && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">Encrypting PDF... {progress}%</p>
                  </div>
                )}

                <Button onClick={handleProtect} disabled={!canProtect} className="w-full">
                  <Lock className="w-4 h-4 mr-2" />
                  {isProcessing ? "Protecting..." : "Protect PDF"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Important: if you forget the password, this PDF cannot be opened.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Download Section */}
          {protectedBlob && (
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold">PDF Protected!</h3>
                <p className="text-muted-foreground">Your PDF is now password-protected with 256-bit AES encryption.</p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Protected PDF
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Protect Another
                  </Button>
                </div>
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
                <span>Set a password and click Protect</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download the protected PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Everything runs locally in your browser — your PDF is not uploaded anywhere.</li>
              <li>• Use a strong password (longer than 8 characters is recommended).</li>
              <li>• If you forget the password, the PDF cannot be opened.</li>
              <li>• Some PDF viewers may show limited permission enforcement depending on the app.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
};

export default PDFProtect;
