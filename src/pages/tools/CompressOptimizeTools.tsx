import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Loader2, X, FileArchive, Copy, Sparkles, Trash2 } from "lucide-react";

// deps:
// npm i jszip file-saver
import JSZip from "jszip";
import { saveAs } from "file-saver";

type MainTab = "zip" | "minify";
type MinifyTab = "json" | "html" | "cssjs";

export default function ZipTools() {
  const { toast } = useToast();

  // Main tabs
  const [mainTab, setMainTab] = useState<MainTab>("zip");

  // ZIP sub-mode
  const [zipMode, setZipMode] = useState<"create" | "extract">("create");

  // Create ZIP state
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [zipping, setZipping] = useState(false);

  // Extract ZIP state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Minify/Prettify state
  const [minifyTab, setMinifyTab] = useState<MinifyTab>("json");
  const [input, setInput] = useState("");

  // ---------- Helpers ----------
  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const v = bytes / Math.pow(k, i);
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const totalCreateBytes = useMemo(() => createFiles.reduce((a, f) => a + f.size, 0), [createFiles]);

  // ---------- Dropzones ----------
  const onDropCreate = useCallback((accepted: File[]) => {
    if (!accepted?.length) return;
    setCreateFiles((prev) => [...prev, ...accepted]);
  }, []);

  const onDropExtract = useCallback(
    (accepted: File[]) => {
      const f = accepted?.[0];
      if (!f) return;

      const isZip = f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip");
      if (!isZip) {
        toast({
          title: "Only .zip files",
          description: "Please upload a ZIP file.",
          variant: "destructive",
        });
        return;
      }
      setZipFile(f);
    },
    [toast],
  );

  const createDZ = useDropzone({
    onDrop: onDropCreate,
    maxFiles: 200,
  });

  const extractDZ = useDropzone({
    onDrop: onDropExtract,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
  });

  // ---------- ZIP actions ----------
  const removeCreateFile = (idx: number) => {
    setCreateFiles((prev) => prev.filter((_, i) => i !== idx));
  };
  const clearCreate = () => setCreateFiles([]);
  const clearExtract = () => setZipFile(null);

  const createZipNow = async () => {
    if (createFiles.length === 0) {
      toast({
        title: "Add files first",
        description: "Drop files to include in the ZIP.",
        variant: "destructive",
      });
      return;
    }

    setZipping(true);
    try {
      const zip = new JSZip();
      for (const f of createFiles) {
        zip.file(f.name, await f.arrayBuffer());
      }

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      saveAs(blob, `files-${new Date().toISOString().slice(0, 10)}.zip`);
      toast({ title: "ZIP created", description: "Your ZIP file was downloaded." });
    } catch (e: any) {
      toast({
        title: "ZIP failed",
        description: e?.message ? String(e.message) : "Something went wrong while creating the ZIP.",
        variant: "destructive",
      });
    } finally {
      setZipping(false);
    }
  };

  const extractZipNow = async () => {
    if (!zipFile) {
      toast({
        title: "Upload a ZIP first",
        description: "Drop a ZIP file to extract.",
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    try {
      const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
      const entries = Object.values(zip.files);

      let extractedCount = 0;
      for (const entry of entries) {
        if (entry.dir) continue;
        const blob = await entry.async("blob");
        const name = entry.name.split("/").pop() || entry.name;
        saveAs(blob, name);
        extractedCount++;
      }

      toast({
        title: "Extracted",
        description: extractedCount
          ? `Downloaded ${extractedCount} file${extractedCount === 1 ? "" : "s"}.`
          : "No files found in this ZIP.",
      });
    } catch (e: any) {
      toast({
        title: "Extract failed",
        description: e?.message ? String(e.message) : "Could not extract this ZIP.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  // ---------- Minify/Prettify output ----------
  const output = useMemo(() => {
    if (!input.trim()) return "";
    try {
      if (minifyTab === "json") {
        const obj = JSON.parse(input);
        return JSON.stringify(obj, null, 2);
      }
      if (minifyTab === "html") {
        return input
          .replace(/>\s+</g, "><")
          .replace(/\s{2,}/g, " ")
          .trim();
      }
      // css/js lightweight minifier
      return input
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s*([{};,:()=+\-*/<>])\s*/g, "$1")
        .trim();
    } catch (e: any) {
      return `⚠️ Error: ${e?.message ? String(e.message) : "Invalid input"}`;
    }
  }, [input, minifyTab]);

  const isError = output.startsWith("⚠️ Error:");

  const copyOut = async () => {
    if (!output || isError) return;
    await navigator.clipboard.writeText(output);
    toast({ title: "Copied", description: "Output copied to clipboard." });
  };

  const clearAllText = () => setInput("");

  return (
    <ToolLayout title="Zip Tools" description="Create and extract zip   — 100% client-side.">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left */}
        <div className="space-y-6">
          <Card className="p-6">
            <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="zip">
                  Zip Tools
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="minify">
                  Minify / Prettify
                </TabsTrigger>
              </TabsList>

              {/* Zip Tools */}
              <TabsContent value="zip" className="mt-6 space-y-5">
                <Tabs value={zipMode} onValueChange={(v) => setZipMode(v as "create" | "extract")}>
                  <TabsList className="w-full">
                    <TabsTrigger className="flex-1" value="create">
                      Create ZIP
                    </TabsTrigger>
                    <TabsTrigger className="flex-1" value="extract">
                      Extract ZIP
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="create" className="mt-5 space-y-4">
                    <div
                      {...createDZ.getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        createDZ.isDragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/50"
                      }`}
                    >
                      <input {...createDZ.getInputProps()} />
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium">Drop files here</p>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-3">Add multiple files, then download a ZIP.</p>
                    </div>

                    {createFiles.length > 0 && (
                      <div className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{createFiles.length}</span> files •{" "}
                            <span className="font-medium text-foreground">{formatBytes(totalCreateBytes)}</span>
                          </div>
                          <Button variant="ghost" className="h-8 px-2" onClick={clearCreate} disabled={zipping}>
                            Clear
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-auto pr-1">
                          {createFiles.map((f, idx) => (
                            <div
                              key={`${f.name}-${idx}`}
                              className="flex items-center justify-between gap-3 rounded-md border p-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">{f.name}</div>
                                <div className="text-xs text-muted-foreground">{formatBytes(f.size)}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCreateFile(idx)}
                                disabled={zipping}
                                aria-label="Remove"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={createZipNow}
                      disabled={zipping || createFiles.length === 0}
                      className="w-full"
                      size="lg"
                    >
                      {zipping ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating ZIP...
                        </>
                      ) : (
                        <>
                          <FileArchive className="h-4 w-4 mr-2" />
                          Download ZIP
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="extract" className="mt-5 space-y-4">
                    <div
                      {...extractDZ.getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        extractDZ.isDragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/50"
                      }`}
                    >
                      <input {...extractDZ.getInputProps()} />
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium">Drop a ZIP here</p>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    </div>

                    {zipFile && (
                      <div className="rounded-md border p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{zipFile.name}</div>
                          <div className="text-xs text-muted-foreground">{formatBytes(zipFile.size)}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={clearExtract}
                          disabled={extracting}
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <Button onClick={extractZipNow} disabled={extracting || !zipFile} className="w-full" size="lg">
                      {extracting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Extract & Download
                        </>
                      )}
                    </Button>

                    <div className="text-xs text-muted-foreground">
                      Browser downloads each extracted file individually (fastest client-only approach).
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Minify / Prettify */}
              <TabsContent value="minify" className="mt-6 space-y-4">
                <Tabs value={minifyTab} onValueChange={(v) => setMinifyTab(v as MinifyTab)}>
                  <TabsList className="w-full">
                    <TabsTrigger className="flex-1" value="json">
                      JSON
                    </TabsTrigger>
                    <TabsTrigger className="flex-1" value="html">
                      HTML
                    </TabsTrigger>
                    <TabsTrigger className="flex-1" value="cssjs">
                      CSS/JS
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-5 space-y-4">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        minifyTab === "json"
                          ? "Paste JSON here..."
                          : minifyTab === "html"
                            ? "Paste HTML here..."
                            : "Paste CSS or JS here..."
                      }
                      className="min-h-[220px]"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={copyOut} disabled={!output || isError}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Output
                      </Button>
                      <Button variant="ghost" onClick={clearAllText} disabled={!input}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear
                      </Button>

                      <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        {minifyTab === "json" ? "Prettify" : "Minify"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold mb-2">Output</div>
                      <pre
                        className={`rounded-md border p-4 text-sm overflow-auto min-h-[180px] ${
                          isError ? "text-destructive" : ""
                        }`}
                      >
                        {output || "Paste input to see output..."}
                      </pre>
                    </div>
                  </div>
                </Tabs>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                <span>Choose a tool tab</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                <span>Upload files or paste code</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  3
                </span>
                <span>Download or copy the result</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • Zip Tools require <code>jszip</code> + <code>file-saver</code>.
              </li>
              <li>• HTML/CSS/JS minifiers are lightweight (not bundler-grade).</li>
              <li>• Everything runs locally in your browser.</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
