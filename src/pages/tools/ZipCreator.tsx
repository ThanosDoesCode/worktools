import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zipSync } from "fflate";

interface Item {
  id: string;
  file: File;
  name: string;
  size: number;
}

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export default function ZipCreator() {
  const [items, setItems] = useState<Item[]>([]);
  const [zipping, setZipping] = useState(false);
  const { toast } = useToast();

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + it.size, 0), [items]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const newItems: Item[] = acceptedFiles.map((file) => ({
        id: safeId(),
        file,
        name: file.name,
        size: file.size,
      }));
      setItems((prev) => [...prev, ...newItems]);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 200,
  });

  const removeItem = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const clearAll = () => setItems([]);

  const createZip = async () => {
    if (items.length === 0) {
      toast({ title: "Add files", description: "Upload files to create a ZIP.", variant: "destructive" });
      return;
    }

    setZipping(true);
    try {
      const entries: Record<string, Uint8Array> = {};

      for (const it of items) {
        const buf = await it.file.arrayBuffer();
        entries[it.name] = new Uint8Array(buf);
      }

      const zipped = zipSync(entries, { level: 6 });
      const blob = new Blob([zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `archive-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast({ title: "ZIP created", description: "Your ZIP file has been downloaded." });
    } catch (e: any) {
      toast({
        title: "ZIP failed",
        description: e?.message ? String(e.message) : "Something went wrong while zipping files.",
        variant: "destructive",
      });
    } finally {
      setZipping(false);
    }
  };

  return (
    <ToolLayout title="ZIP Creator" description="Create ZIP files from any files — fast, private, and client-side.">
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
              <p className="text-lg font-medium">Drop files here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Add multiple files and download one ZIP.</p>
            </div>
          </Card>

          {items.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{items.length}</span> file{items.length === 1 ? "" : "s"} •{" "}
                  <span className="font-medium text-foreground">{formatBytes(totalSize)}</span>
                </div>
                <Button variant="ghost" onClick={clearAll} className="h-8 px-2" disabled={zipping}>
                  Clear
                </Button>
              </div>

              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-xs text-muted-foreground">{formatBytes(it.size)}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)} disabled={zipping}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={createZip} disabled={items.length === 0 || zipping} className="w-full" size="lg">
            {zipping ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating ZIP...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download ZIP
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                <span>Upload any files</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                <span>We zip them in your browser</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                <span>Download one .zip file</span>
              </li>
            </ol>
          </Card>

          <Card className="p-6 bg-muted/50">
            <h3 className="font-semibold mb-2">Privacy</h3>
            <p className="text-sm text-muted-foreground">Files never leave your device.</p>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
