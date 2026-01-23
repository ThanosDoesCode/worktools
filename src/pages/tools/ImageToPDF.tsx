import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { jsPDF } from 'jspdf';
import Image from 'next/image';

interface ImageFile extends File {
  preview: string;
}

export default function ImagesToPDF() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [converting, setConverting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );
    setImages(prev => [...prev, ...imageFiles]);
    setPdfUrl(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff', '.tif']
    },
    multiple: true
  });

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const convertToPDF = async () => {
    if (images.length === 0) return;
    
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
          images[i].type.split('/')[1].toUpperCase(),
          imgX,
          imgY,
          imgWidth * ratio,
          imgHeight * ratio
        );
      }

      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Conversion error:', error);
      alert('Failed to convert images to PDF. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;
    
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `converted-images-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setPdfUrl(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Images to PDF</h1>
          <p className="text-lg text-gray-600">
            Convert JPG, PNG, WebP, HEIC, or TIFF images to PDF
          </p>
        </div>

        <div className="mt-10 bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="px-6 py-8">
            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                ${isDragActive 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="mx-auto w-16 h-16 mb-4 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-xl font-medium text-gray-700 mb-2">
                {isDragActive ? 'Drop images here' : 'Drop images here or click to browse'}
              </p>
              <p className="text-sm text-gray-500">
                Supports JPG, PNG, WebP, HEIC, and TIFF
              </p>
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {images.length} image{images.length > 1 ? 's' : ''} selected
                  </h3>
                  <button
                    onClick={clearAll}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear all
                  </button>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-64 overflow-y-auto p-2">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={img.preview}
                          alt={img.name}
                          width={120}
                          height={120}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="mt-1 text-xs text-gray-500 truncate">{img.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Convert Button */}
            {images.length > 0 && !pdfUrl && (
              <div className="mt-8">
                <button
                  onClick={convertToPDF}
                  disabled={converting}
                  className={`
                    w-full py-3 px-4 rounded-lg font-medium text-white
                    ${converting 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 transition-colors'
                    }
                  `}
                >
                  {converting ? 'Converting...' : `Convert to PDF`}
                </button>
              </div>
            )}

            {/* Download Section */}
            {pdfUrl && (
              <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center mb-4">
                  <svg className="w-8 h-8 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-green-900">PDF created successfully!</h3>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={downloadPDF}
                    className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                  >
                    Convert more images
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>• Drag and drop multiple images or click to select</p>
          <p>• Images will be converted in the order they appear</p>
          <p>• Each image will be placed on a separate page</p>
        </div>
      </div>
    </div>
  );
}
