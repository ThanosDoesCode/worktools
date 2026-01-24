import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, Lock, Download, FileText, Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/layout/ToolLayout";

const PDFProtect: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [protectedBlob, setProtectedBlob] = useState<Blob | null>(null);

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
      // Dynamic import for code splitting
      const [{ default: createModule }, wasmModule] = await Promise.all([
        import("@neslinesli93/qpdf-wasm"),
        import("@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url"),
      ]);

      setProgress(30);

      const qpdf = await createModule({
        locateFile: () => wasmModule.default,
      });

      setProgress(50);

      // Read the input PDF
      const arrayBuffer = await file.arrayBuffer();
      const inputBytes = new Uint8Array(arrayBuffer);

      // Write to virtual filesystem using Emscripten FS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FS = (qpdf as any).FS;
      FS.writeFile("input.pdf", inputBytes);

      setProgress(70);

      // Encrypt the PDF with 256-bit AES encryption
      qpdf.callMain([
        "--encrypt",
        password,
        password,
        "256",
        "--",
        "input.pdf",
        "output.pdf",
      ]);

      setProgress(90);

      // Read the protected file
      const protectedBytes = FS.readFile("output.pdf");
      const blob = new Blob([new Uint8Array(protectedBytes)], {
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* File Upload */}
        <Card>
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              {file ? (
                <div className="space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium">
                    {isDragActive
                      ? "Drop your PDF here..."
                      : "Drag & drop a PDF file here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    or click to browse
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Password Input */}
        {file && !protectedBlob && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Set Password Protection</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min 4 characters)"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
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
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Encrypting PDF... {progress}%
                  </p>
                </div>
              )}

              <Button
                onClick={handleProtect}
                disabled={isProcessing || !password || !confirmPassword}
                className="w-full"
              >
                <Lock className="w-4 h-4 mr-2" />
                {isProcessing ? "Protecting..." : "Protect PDF"}
              </Button>
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
              <p className="text-muted-foreground">
                Your PDF is now password-protected with 256-bit AES encryption.
              </p>
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
    </ToolLayout>
  );
};

export default PDFProtect;
