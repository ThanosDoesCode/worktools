import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { unzipSync } from "fflate";

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
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

export default function ZipExtractor() {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [working, setWorking] = useState(false);
  const { toast } = useToast();

  const totalOut = useMemo(() => entries.reduce((acc, e) => acc + e.size, 0), [entries]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const isZip = file.type === "application/zip" || file.name.toLowerCase().endsWith(".zip");
    if (!isZip) {
      toast({ title: "Only ZIP supported", description: "Upload a .zip file.", variant: "destructive" });
      return;
    }

    setZipFile(file);
    setWorking(true);
    try {
      const buf = await file.arrayBuffer();
      const out = unzipSync(new Uint8Array(buf));

      const list: ZipEntry[] = Object.keys(out).map((name) => ({
        name,
        bytes: out[name],
        size: out[name].byteLength,
      }));

      setEntries(list);
      toast({ title: "Extracted", description: `${list.length} file(s) found.` });
    } catch (e: any) {
      setZipFile(null);
      setEntries([]);
      toast({
        title: "Extraction failed",
        description: e?.message ? String(e.message) : "Could not extract this ZIP.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { "application/zip": [".zip"] },
  });

  const clearAll = () => {
    setZipFile(null);
    setEntries([]);
  };

  const downloadEntry = (e: ZipEntry) => {
    const blob = new Blob([e.bytes]);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = e.name.split("/").pop() || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <ToolLayout title="ZIP Extractor" description="Extract files from ZIP archives — client-side, private.">
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
              <p className="text-lg font-medium">Drop ZIP here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
          </Card>

          {zipFile && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{zipFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {entries.length} file(s) • Output {formatBytes(totalOut)}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearAll} disabled={working}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {entries.length > 0 && (
            <Card className="p-4">
              <div className="space-y-2 max-h-96 overflow-auto pr-1">
                {entries.map((e) => (
                  <div key={e.name} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{formatBytes(e.size)}</div>
                      </div>
                    </div>
                    <Button onClick={() => downloadEntry(e)} size="sm" disabled={working}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button disabled className="w-full" size="lg">
            {working ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              "Upload a ZIP to extract"
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Notes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• ZIP extraction runs locally in your browser</li>
              <li>• Large ZIPs depend on your device memory</li>
              <li>• For RAR/7Z we’d add separate tools later</li>
            </ul>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
}
