import { useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Copy, RefreshCw, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

const GeneratorTools = () => {
  const { toast } = useToast();

  // Password Generator State
  const [passwordLength, setPasswordLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState("");

  // UUID Generator State
  const [generatedUUIDs, setGeneratedUUIDs] = useState<string[]>([]);
  const [uuidCount, setUuidCount] = useState(1);

  // Lorem Ipsum State
  const [loremParagraphs, setLoremParagraphs] = useState(3);
  const [generatedLorem, setGeneratedLorem] = useState("");

  // QR Code State
  const [qrText, setQrText] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Barcode State
  const [barcodeText, setBarcodeText] = useState("");
  const [barcodeDataUrl, setBarcodeDataUrl] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  // Password Generator
  const generatePassword = () => {
    let chars = "";
    if (includeUppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (includeLowercase) chars += "abcdefghijklmnopqrstuvwxyz";
    if (includeNumbers) chars += "0123456789";
    if (includeSymbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";

    if (!chars) {
      toast({
        title: "Please select at least one character type",
        variant: "destructive",
      });
      return;
    }

    let password = "";
    for (let i = 0; i < passwordLength; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
  };

  // UUID Generator
  const generateUUIDs = () => {
    const uuids: string[] = [];
    for (let i = 0; i < uuidCount; i++) {
      uuids.push(crypto.randomUUID());
    }
    setGeneratedUUIDs(uuids);
  };

  // Lorem Ipsum Generator
  const loremWords = [
    "lorem",
    "ipsum",
    "dolor",
    "sit",
    "amet",
    "consectetur",
    "adipiscing",
    "elit",
    "sed",
    "do",
    "eiusmod",
    "tempor",
    "incididunt",
    "ut",
    "labore",
    "et",
    "dolore",
    "magna",
    "aliqua",
    "enim",
    "ad",
    "minim",
    "veniam",
    "quis",
    "nostrud",
    "exercitation",
    "ullamco",
    "laboris",
    "nisi",
    "aliquip",
    "ex",
    "ea",
    "commodo",
    "consequat",
    "duis",
    "aute",
    "irure",
    "in",
    "reprehenderit",
    "voluptate",
    "velit",
    "esse",
    "cillum",
    "fugiat",
    "nulla",
    "pariatur",
    "excepteur",
    "sint",
    "occaecat",
    "cupidatat",
    "non",
    "proident",
    "sunt",
    "culpa",
    "qui",
    "officia",
    "deserunt",
    "mollit",
    "anim",
    "id",
    "est",
    "laborum",
  ];

  const generateLorem = () => {
    const paragraphs: string[] = [];
    for (let p = 0; p < loremParagraphs; p++) {
      const sentenceCount = Math.floor(Math.random() * 4) + 4;
      const sentences: string[] = [];
      for (let s = 0; s < sentenceCount; s++) {
        const wordCount = Math.floor(Math.random() * 10) + 8;
        const words: string[] = [];
        for (let w = 0; w < wordCount; w++) {
          words.push(loremWords[Math.floor(Math.random() * loremWords.length)]);
        }
        words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        sentences.push(words.join(" ") + ".");
      }
      paragraphs.push(sentences.join(" "));
    }
    setGeneratedLorem(paragraphs.join("\n\n"));
  };

  // QR Code Generator
  const generateQRCode = async () => {
    if (!qrText.trim()) {
      toast({ title: "Please enter text or URL", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(qrText, { width: 256, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch {
      toast({ title: "Failed to generate QR code", variant: "destructive" });
    }
  };

  // Barcode Generator
  const generateBarcode = () => {
    if (!barcodeText.trim()) {
      toast({ title: "Please enter text for barcode", variant: "destructive" });
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, barcodeText, { format: "CODE128", width: 2, height: 100 });
      setBarcodeDataUrl(canvas.toDataURL());
    } catch {
      toast({ title: "Failed to generate barcode", variant: "destructive" });
    }
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  return (
    <ToolLayout
      title="Generator Tools"
      description="QR codes, passwords, UUIDs, lorem ipsum, barcodes — all in one place"
    >
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="password" className="w-full">
            {/* ✅ MOBILE + iPad friendly: horizontal scroll on small screens, wrap on larger */}
            <TabsList
              className="
                w-full mb-6
                flex items-center gap-2 justify-start
                overflow-x-auto max-w-full
                whitespace-nowrap
                rounded-lg p-1
                [-ms-overflow-style:none] [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
                sm:flex-wrap sm:overflow-visible
              "
            >
              <TabsTrigger value="password" className="shrink-0 min-w-max px-4">
                Password
              </TabsTrigger>
              <TabsTrigger value="uuid" className="shrink-0 min-w-max px-4">
                UUID
              </TabsTrigger>
              <TabsTrigger value="lorem" className="shrink-0 min-w-max px-4">
                Lorem Ipsum
              </TabsTrigger>
              <TabsTrigger value="qrcode" className="shrink-0 min-w-max px-4">
                QR Code
              </TabsTrigger>
              <TabsTrigger value="barcode" className="shrink-0 min-w-max px-4">
                Barcode
              </TabsTrigger>
            </TabsList>

            {/* Password Generator */}
            <TabsContent value="password" className="space-y-5 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Password Length: {passwordLength}</Label>
                  <Slider
                    value={[passwordLength]}
                    onValueChange={(v) => setPasswordLength(v[0])}
                    min={8}
                    max={64}
                    step={1}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="uppercase"
                      checked={includeUppercase}
                      onCheckedChange={(c) => setIncludeUppercase(!!c)}
                    />
                    <Label htmlFor="uppercase" className="text-sm sm:text-base">
                      Uppercase (A-Z)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="lowercase"
                      checked={includeLowercase}
                      onCheckedChange={(c) => setIncludeLowercase(!!c)}
                    />
                    <Label htmlFor="lowercase" className="text-sm sm:text-base">
                      Lowercase (a-z)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="numbers" checked={includeNumbers} onCheckedChange={(c) => setIncludeNumbers(!!c)} />
                    <Label htmlFor="numbers" className="text-sm sm:text-base">
                      Numbers (0-9)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="symbols" checked={includeSymbols} onCheckedChange={(c) => setIncludeSymbols(!!c)} />
                    <Label htmlFor="symbols" className="text-sm sm:text-base">
                      Symbols (!@#$...)
                    </Label>
                  </div>
                </div>

                <Button onClick={generatePassword} className="w-full h-11">
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate Password
                </Button>

                {generatedPassword && (
                  <div className="p-3 sm:p-4 bg-muted rounded-lg flex items-start sm:items-center justify-between gap-3">
                    <code className="text-xs sm:text-sm break-all leading-relaxed">{generatedPassword}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard(generatedPassword)}
                      aria-label="Copy password"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* UUID Generator */}
            <TabsContent value="uuid" className="space-y-5 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Number of UUIDs: {uuidCount}</Label>
                  <Slider value={[uuidCount]} onValueChange={(v) => setUuidCount(v[0])} min={1} max={10} step={1} />
                </div>

                <Button onClick={generateUUIDs} className="w-full h-11">
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate UUIDs
                </Button>

                {generatedUUIDs.length > 0 && (
                  <div className="space-y-2">
                    {generatedUUIDs.map((uuid, i) => (
                      <div
                        key={i}
                        className="p-3 bg-muted rounded-lg flex items-start sm:items-center justify-between gap-3"
                      >
                        <code className="text-xs sm:text-sm break-all leading-relaxed">{uuid}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => copyToClipboard(uuid)}
                          aria-label="Copy UUID"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => copyToClipboard(generatedUUIDs.join("\n"))}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy All
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Lorem Ipsum Generator */}
            <TabsContent value="lorem" className="space-y-5 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Number of Paragraphs: {loremParagraphs}</Label>
                  <Slider
                    value={[loremParagraphs]}
                    onValueChange={(v) => setLoremParagraphs(v[0])}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                <Button onClick={generateLorem} className="w-full h-11">
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate Lorem Ipsum
                </Button>

                {generatedLorem && (
                  <div className="space-y-2">
                    <Textarea
                      value={generatedLorem}
                      readOnly
                      rows={10}
                      className="font-mono text-xs sm:text-sm leading-relaxed"
                    />
                    <Button variant="outline" className="w-full h-11" onClick={() => copyToClipboard(generatedLorem)}>
                      <Copy className="mr-2 h-4 w-4" /> Copy Text
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* QR Code Generator */}
            <TabsContent value="qrcode" className="space-y-5 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-text">Text or URL</Label>
                  <Input
                    id="qr-text"
                    value={qrText}
                    onChange={(e) => setQrText(e.target.value)}
                    placeholder="Enter text or URL..."
                    className="h-11"
                  />
                </div>

                <Button onClick={generateQRCode} className="w-full h-11">
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate QR Code
                </Button>

                {qrDataUrl && (
                  <div className="flex flex-col items-center space-y-4">
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      className="border rounded-lg w-full max-w-[260px] sm:max-w-[320px] h-auto"
                    />
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto h-11"
                      onClick={() => downloadImage(qrDataUrl, "qrcode.png")}
                    >
                      <Download className="mr-2 h-4 w-4" /> Download PNG
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Barcode Generator */}
            <TabsContent value="barcode" className="space-y-5 sm:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode-text">Text</Label>
                  <Input
                    id="barcode-text"
                    value={barcodeText}
                    onChange={(e) => setBarcodeText(e.target.value)}
                    placeholder="Enter text for barcode..."
                    className="h-11"
                  />
                </div>

                <Button onClick={generateBarcode} className="w-full h-11">
                  <RefreshCw className="mr-2 h-4 w-4" /> Generate Barcode
                </Button>

                {barcodeDataUrl && (
                  <div className="flex flex-col items-center space-y-4">
                    <img
                      src={barcodeDataUrl}
                      alt="Barcode"
                      className="border rounded-lg bg-white p-2 w-full max-w-[360px] h-auto"
                    />
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto h-11"
                      onClick={() => downloadImage(barcodeDataUrl, "barcode.png")}
                    >
                      <Download className="mr-2 h-4 w-4" /> Download PNG
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ToolLayout>
  );
};

export default GeneratorTools;
