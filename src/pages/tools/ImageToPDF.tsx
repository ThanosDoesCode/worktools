import { useState, useCallback } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Button } from "@/components/ui/button";
import { useDropzone } from "react-dropzone";
import { jsPDF } from "jspdf";
import { Copy, Download, Trash2, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";

export default function ImageToPDF() {
  const [images, setImages] = useState<any[]>([]);
  const [converting, setConverting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));
    setImages((prev) => [...prev, ...imageFiles]);
    setPdfUrl(null);
    toast.success(`Added ${acceptedFiles.length} image${acceptedFiles.length > 1 ? "s" : ""}`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".tiff", ".tif"],
    },
    multiple: true,
  });

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index].preview);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setPdfUrl(null);
  };

  const convertToPDF = async () => {
    if (images.length === 0) {
      toast.error("Please add at least one image");
      return;
    }

    setConverting(true);
    const pdf = new jsPDF();

    try {
      for (let i = 0; i < images.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const img = await new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = images[i].preview;
        });

        const imgWidth = img.width;
        const imgHeight = img.height;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        const imgX = (pageWidth - imgWidth * ratio) / 2;
        const imgY = (pageHeight - imgHeight * ratio) / 2;

        pdf.addImage(
          images[i].preview,
          images[i].file.type.split("/")[1].toUpperCase(),
          imgX,
          imgY,
          imgWidth * ratio,
          imgHeight * ratio,
        );
      }

      const pdfBlob = pdf.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      toast.success("PDF created successfully!");
    } catch (error) {
      console.error("Conversion error:", error);
      toast.error("Failed to convert images to PDF");
    } finally {
      setConverting(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;

    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `converted-images-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("PDF downloaded");
  };

  const handleCopy = () => {
    const text = `Image to PDF Conversion
Images: ${images.length}
Status: ${pdfUrl ? "PDF generated" : "Ready to convert"}`;

    navigator.clipboard.writeText(text);
    toast.success("Results copied to clipboard");
  };

  const totalSize = useMemo(() => {
    return images.reduce((acc, img) => acc + img.size, 0);
  }, [images]);

  return (
    <ToolLayout
      title="Images to PDF"
      description="Convert JPG, PNG, WebP, HEIC, or TIFF images to PDF"
      icon={<FileText className="h-5 w-5" />}
    >
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-6">
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground hover:bg-surface"
                }
              `}
            >
              <input {...getInputProps()} />
              <ImageIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-medium text-foreground mb-2">
                {isDragActive ? "Drop images here" : "Drop images here or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground">Supports JPG, PNG, WebP, HEIC, and TIFF</p>
            </div>

            {/* Image Preview */}
            {images.length > 0 && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-foreground">
                      {images.length} image{images.length > 1 ? "s" : ""} selected
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Total size: {(totalSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                    className="text-destructive border-destructive hover:bg-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Clear All
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 max-h-64 overflow-y-auto p-2">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{img.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleCopy} variant="outline">
              <Copy className="h-4 w-4 mr-2" /> Copy Info
            </Button>
            {pdfUrl && (
              <Button onClick={downloadPDF} className="flex-1">
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <div className="bg-surface-elevated rounded-xl p-6 border border-border">
            <h3 className="text-xl font-semibold text-foreground mb-6">Conversion Status</h3>

            {images.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-foreground font-medium">No images added yet</p>
                <p className="text-muted-foreground text-sm mt-1">Drop images on the left to get started</p>
              </div>
            ) : !pdfUrl ? (
              <div className="space-y-4">
                <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Ready to Convert</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      • {images.length} image{images.length > 1 ? "s" : ""} will be converted
                    </li>
                    <li>• Each image will be on a separate page</li>
                    <li>• Images will be automatically sized to fit</li>
                  </ul>
                </div>

                <Button onClick={convertToPDF} disabled={converting} className="w-full" size="lg">
                  {converting
                    ? "Converting..."
                    : `Convert ${images.length} Image${images.length > 1 ? "s" : ""} to PDF`}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <h4 className="font-medium text-green-600 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    PDF Generated Successfully!
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Your PDF is ready for download. Click the button below to save it.
                  </p>
                </div>

                <Button onClick={downloadPDF} className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>

                <Button
                  onClick={() => {
                    clearAll();
                    toast.info("Start a new conversion");
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Convert New Images
                </Button>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-8 pt-6 border-t border-border">
              <h4 className="font-medium text-foreground mb-3">How it works:</h4>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">1.</span>
                  Drop multiple images or click to select files
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">2.</span>
                  Click "Convert to PDF" button
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-semibold">3.</span>
                  Download your PDF with each image on a separate page
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
