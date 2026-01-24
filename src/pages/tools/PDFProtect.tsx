import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  Download,
  FileText,
  Loader2,
  Lock,
  Unlock,
  Shield,
} from "lucide-react";

import createModule from "@neslinesli93/qpdf-wasm";
// Option A (Vite): uncomment this and use locateFile: () => wasmUrl
// import wasmUrl from "@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url";

type Mode = "protect" | "unlock";
type PrintLevel = "full" | "low" | "none";
type ModifyLevel = "all" | "annotate" | "form" | "assembly" | "none";

interface PDFFile {
  file: File;
  name: string;
  size: number;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function baseName(name: string) {
  return (name || "document").replace(/\.pdf$/i, "") || "document";
}

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function uint8ToBlobUrl(u8: Uint8Array, mime = "application/pdf") {
  return URL.createObjectURL(new Blob([u8], { type: mime }));
}

export default function PDFProtect() {
  const { toast } = useToast();

  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null);
  const [working, setWorking] = useState(false);

  // qpdf wasm module (singleton)
  const qpdfRef = useRef<any | null>(null);
  const [qpdfReady, setQpdfReady] = useState(false);

  // UI
  const [mode, setMode] = useState<Mode>("protect");

  // Protect settings
  const [openPassword, setOpenPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [useSamePassword, setUseSamePassword] = useState(true);

  const [printLevel, setPrintLevel] = useState<PrintLevel>("full");
  const [modifyLevel, setModifyLevel] = useState<ModifyLevel>("all");
  const [allowExtract, setAllowExtract] = useState(true);
  const [allowAnnotate, setAllowAnnotate] = useState(true);
  const [allowAssemble, setAllowAssemble] = useState(true);
  const [allowFormFill, setAllowFormFill] = useState(true);

  // Unlock settings
  const [currentPassword, setCurrentPassword] = useState("");

  // output
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outName, setOutName] = useState<string | null>(null);
  const [outSize, setOutSize] = useState<number | null>(null);

  // init qpdf once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const qpdf = await createModule({
          // Option A (Vite): locateFile: () => wasmUrl,
          // Option B (public): copy wasm to /public/wasm/qpdf.wasm
          locateFile: () => "/wasm/qpdf.wasm",
          noInitialRun: true,
          preRun: [
            (module: any) => {
              try {
                module.FS.mkdir("/in");
              } catch {}
              try {
                module.FS.mkdir("/out");
              } catch {}
            },
          ],
        });

        if (!mounted) return;
        qpdfRef.current = qpdf;
        setQpdfReady(true);
      } catch (e: any) {
        if (!mounted) return;
        setQpdfReady(false);
        toast({
          title: "Failed to load PDF engine",
          description:
            "Could not initialize QPDF (WASM). Make sure qpdf.wasm is accessible (see setup step).",
          variant: "destructive",
        });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const clearAll = () => {
    setPdfFile(null);
    if (outUrl) URL.revokeObjectURL(outUrl);
    setOutUrl(null);
    setOutName(null);
    setOutSize(null);
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast({
          title: "Only PDFs supported",
          description: "Upload a .pdf file.",
          variant: "destructive",
        });
        return;
      }

      // clear previous output
      if (outUrl) URL.revokeObjectURL(outUrl);
      setOutUrl(null);
      setOutName(null);
      setOutSize(null);

      setPdfFile({ file, name: file.name, size: file.size });
      toast({ title: "Loaded", description: "PDF ready." });
    },
    [toast, outUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  });

  const canRun = useMemo(() => {
    if (!qpdfReady || !pdfFile || working) return false;
    if (mode === "protect") {
      if (!openPassword.trim()) return false;
      if (!useSamePassword && !ownerPassword.trim()) return false;
      return true;
    }
    // unlock
    return !!currentPassword.trim();
  }, [qpdfReady, pdfFile, working, mode, openPassword, ownerPassword, useSamePassword, currentPassword]);

  const buildPermissionsFlags = () => {
    const flags: string[] = [];

    // printing
    flags.push(`--print=${printLevel}`);

    // modifying
    flags.push(`--modify=${modifyLevel}`);

    // these are toggles; qpdf uses =n to disable (or omit to allow)
    if (!allowExtract) flags.push("--extract=n");
    if (!allowAnnotate) flags.push("--annotate=n");
    if (!allowAssemble) flags.push("--assemble=n");
    if (!allowFormFill) flags.push("--form=n");

    return flags;
  };

  const runNow = async () => {
    if (!pdfFile || !qpdfRef.current) return;
    if (!canRun) return;

    setWorking(true);

    try {
      const qpdf = qpdfRef.current;

      // cleanup old output in FS (best-effort)
      try { qpdf.FS.unlink("/in/input.pdf"); } catch {}
      try { qpdf.FS.unlink("/out/output.pdf"); } catch {}

      // write input
      const buf = new Uint8Array(await pdfFile.file.arrayBuffer());
      qpdf.FS.writeFile("/in/input.pdf", buf);

      const outFile = "/out/output.pdf";

      if (mode === "protect") {
        const user = openPassword;
        const owner = useSamePassword ? openPassword : ownerPassword;

        const permFlags = buildPermissionsFlags();

        // qpdf [infile] [options] [outfile]
        // encryption options use: --encrypt user owner 256 [restrictions] --  outfile
        // We include "--" to terminate encryption args cleanly.
        qpdf.callMain([
          "/in/input.pdf",
          "--encrypt",
          user,
          owner,
          "256",
          ...permFlags,
          "--",
          outFile,
        ]);

        const out = qpdf.FS.readFile(outFile) as Uint8Array;

        const name = `${baseName(pdfFile.name)}-protected.pdf`;
        const url = uint8ToBlobUrl(out);

        if (outUrl) URL.revokeObjectURL(outUrl);
        setOutUrl(url);
        setOutName(name);
        setOutSize(out.byteLength);

        toast({ title: "Protected!", description: "Password-protected PDF ready to download." });
      } else {
        // unlock/remove password (requires knowing the password)
        qpdf.callMain([
          "/in/input.pdf",
          `--password=${currentPassword}`,
          "--decrypt",
          outFile,
        ]);

        const out = qpdf.FS.readFile(outFile) as Uint8Array;

        const name = `${baseName(pdfFile.name)}-unlocked.pdf`;
        const url = uint8ToBlobUrl(out);

        if (outUrl) URL.revokeObjectURL(outUrl);
        setOutUrl(url);
        setOutName(name);
        setOutSize(out.byteLength);

        toast({ title: "Unlocked!", description: "Decrypted PDF ready to download." });
      }
    } catch (e: any) {
      toast({
        title: "Operation failed",
        description: e?.message ? String(e.message) : "Something went wrong while processing the PDF.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const downloadOut = () => {
    if (!outUrl || !outName) return;
    const a = document.createElement("a");
    a.href = outUrl;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <ToolLayout
      title="PDF Protect"
      description="Password-protect (encrypt) a PDF — or remove a password if you know it. Everything runs locally in your browser."
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left */}
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
              <p className="text-xs text-muted-foreground mt-3">
                {qpdfReady ? "Encryption engine loaded" : "Loading encryption engine…"}
              </p>
            </div>
          </Card>

          {pdfFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-7 w-7 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">{formatBytes(pdfFile.size)}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearAll} disabled={working}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Settings */}
          <Card className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="protect">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Protect (add password)
                    </div>
                  </SelectItem>
                  <SelectItem value="unlock">
                    <div className="flex items-center gap-2">
                      <Unlock className="h-4 w-4" /> Unlock (remove password)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Unlock requires you to know the current password.
              </p>
            </div>

            {mode === "protect" ? (
              <>
                <div className="space-y-2">
                  <Label>Open password</Label>
                  <Input
                    type="password"
                    value={openPassword}
                    onChange={(e) => setOpenPassword(e.target.value)}
                    placeholder="Required"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Use same owner password</Label>
                    <p className="text-xs text-muted-foreground">Owner can override restrictions</p>
                  </div>
                  <Switch checked={useSamePassword} onCheckedChange={setUseSamePassword} />
                </div>

                {!useSamePassword && (
                  <div className="space-y-2">
                    <Label>Owner password</Label>
                    <Input
                      type="password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Required if not using the same password"
                    />
                  </div>
                )}

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <div className="font-medium">Permissions</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Printing</Label>
                      <Select value={printLevel} onValueChange={(v) => setPrintLevel(v as PrintLevel)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                    Uses AES-256 PDF encryption and standard permission flags.
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Required to unlock"
                />
              </div>
            )}
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={runNow} disabled={!canRun} className="w-full" size="lg">
              {working ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Working…
                </>
              ) : mode === "protect" ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Protect PDF
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Unlock PDF
                </>
              )}
            </Button>

            <Button
              onClick={downloadOut}
              disabled={!outUrl}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {outUrl && outName && (
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">
                Output: <span className="font-medium text-foreground">{outName}</span>
                {outSize != null && (
                  <>
                    {" "}
                    • <span className="font-medium text-foreground">{formatBytes(outSize)}</span>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                <span>Upload a PDF (stays on your device)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                <span>Choose Protect or Unlock and configure options</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                <span>Process locally and download the new PDF</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Protect uses AES-256 PDF encryption and standard permission flags.</li>
              <li>• Unlock only works if you know the current password.</li>
              <li>• Everything runs in your browser (no upload).</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
