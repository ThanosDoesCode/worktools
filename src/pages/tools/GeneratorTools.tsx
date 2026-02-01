import { useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Copy, RefreshCw, Download, Key, Hash, FileText, QrCode, Barcode, Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

/** Moat layer */
import { useMoat } from "@/hooks/useMoat";
import { PresetsPanel } from "@/components/moat/PresetsPanel";
import { CopyLinkButton } from "@/components/moat/CopyLinkButton";
import { LocalStatusIndicator } from "@/components/moat/LocalStatusIndicator";

type QRTemplate = "text" | "wifi" | "email" | "sms" | "vcard";
type QRErrorCorrection = "L" | "M" | "Q" | "H";

type BarcodeFormat = "CODE128" | "EAN13" | "UPC" | "ITF" | "CODE39";

type MoatSettings = {
  // Password
  passwordLength: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  mustIncludeEachSelected: boolean;

  // UUID
  uuidCount: number;

  // Lorem
  loremParagraphs: number;

  // QR
  qrTemplate: QRTemplate;
  qrText: string;
  qrWifiSsid: string;
  qrWifiPass: string;
  qrWifiHidden: boolean;
  qrWifiAuth: "WPA" | "WEP" | "nopass";
  qrEmailTo: string;
  qrEmailSubject: string;
  qrEmailBody: string;
  qrSmsTo: string;
  qrSmsBody: string;
  qrVcardName: string;
  qrVcardOrg: string;
  qrVcardPhone: string;
  qrVcardEmail: string;
  qrVcardUrl: string;

  qrSize: number;
  qrMargin: number;
  qrEcc: QRErrorCorrection;

  // Barcode
  barcodeText: string;
  barcodeFormat: BarcodeFormat;
  barcodeWidth: number;
  barcodeHeight: number;

  // UI
  activeTab: "password" | "uuid" | "lorem" | "qrcode" | "barcode";
};

const DEFAULT_SETTINGS: MoatSettings = {
  passwordLength: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  mustIncludeEachSelected: true,

  uuidCount: 1,

  loremParagraphs: 3,

  qrTemplate: "text",
  qrText: "",
  qrWifiSsid: "",
  qrWifiPass: "",
  qrWifiHidden: false,
  qrWifiAuth: "WPA",
  qrEmailTo: "",
  qrEmailSubject: "",
  qrEmailBody: "",
  qrSmsTo: "",
  qrSmsBody: "",
  qrVcardName: "",
  qrVcardOrg: "",
  qrVcardPhone: "",
  qrVcardEmail: "",
  qrVcardUrl: "",

  qrSize: 256,
  qrMargin: 2,
  qrEcc: "M",

  barcodeText: "",
  barcodeFormat: "CODE128",
  barcodeWidth: 2,
  barcodeHeight: 100,

  activeTab: "password",
};

const RECOMMENDED_PRESETS = [
  // QR templates (these are real “presets” here)
  {
    name: "QR: Wi-Fi",
    settings: { ...DEFAULT_SETTINGS, activeTab: "qrcode", qrTemplate: "wifi" } satisfies MoatSettings,
  },
  {
    name: "QR: Email",
    settings: { ...DEFAULT_SETTINGS, activeTab: "qrcode", qrTemplate: "email" } satisfies MoatSettings,
  },
  {
    name: "QR: SMS",
    settings: { ...DEFAULT_SETTINGS, activeTab: "qrcode", qrTemplate: "sms" } satisfies MoatSettings,
  },
  {
    name: "QR: vCard",
    settings: { ...DEFAULT_SETTINGS, activeTab: "qrcode", qrTemplate: "vcard" } satisfies MoatSettings,
  },

  // Barcode presets (format)
  {
    name: "Barcode: CODE128",
    settings: { ...DEFAULT_SETTINGS, activeTab: "barcode", barcodeFormat: "CODE128" } satisfies MoatSettings,
  },
  {
    name: "Barcode: EAN13",
    settings: { ...DEFAULT_SETTINGS, activeTab: "barcode", barcodeFormat: "EAN13" } satisfies MoatSettings,
  },
  {
    name: "Barcode: UPC",
    settings: { ...DEFAULT_SETTINGS, activeTab: "barcode", barcodeFormat: "UPC" } satisfies MoatSettings,
  },
];

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function buildWifiPayload(ssid: string, pass: string, auth: "WPA" | "WEP" | "nopass", hidden: boolean) {
  // WIFI:T:WPA;S:mynetwork;P:mypass;H:false;;
  const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
  const t = auth;
  const S = esc(ssid || "");
  const P = esc(pass || "");
  const H = hidden ? "true" : "false";
  return `WIFI:T:${t};S:${S};P:${P};H:${H};;`;
}

function buildMailto(to: string, subject: string, body: string) {
  const qp = new URLSearchParams();
  if (subject) qp.set("subject", subject);
  if (body) qp.set("body", body);
  const q = qp.toString();
  return `mailto:${encodeURIComponent(to || "")}${q ? `?${q}` : ""}`;
}

function buildSms(to: string, body: string) {
  const qp = new URLSearchParams();
  if (body) qp.set("body", body);
  const q = qp.toString();
  return `sms:${encodeURIComponent(to || "")}${q ? `?${q}` : ""}`;
}

function buildVCard(name: string, org: string, phone: string, email: string, url: string) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    name ? `FN:${name}` : "",
    org ? `ORG:${org}` : "",
    phone ? `TEL;TYPE=CELL:${phone}` : "",
    email ? `EMAIL:${email}` : "",
    url ? `URL:${url}` : "",
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}

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

function generateLoremText(paragraphsCount: number) {
  const paragraphs: string[] = [];
  for (let p = 0; p < paragraphsCount; p++) {
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
  return paragraphs.join("\n\n");
}

function buildPasswordChars(s: MoatSettings) {
  let chars = "";
  if (s.includeUppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (s.includeLowercase) chars += "abcdefghijklmnopqrstuvwxyz";
  if (s.includeNumbers) chars += "0123456789";
  if (s.includeSymbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
  return chars;
}

function pickRandom(str: string) {
  return str.charAt(Math.floor(Math.random() * str.length));
}

function shuffle(arr: string[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const MAX_HISTORY = 20;

const GeneratorTools = () => {
  const { toast } = useToast();
  const toolSlug = "generator-tools";

  const [settings, setSettings] = useState<MoatSettings>(DEFAULT_SETTINGS);

  // Outputs
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [generatedUUIDs, setGeneratedUUIDs] = useState<string[]>([]);
  const [generatedLorem, setGeneratedLorem] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [barcodeDataUrl, setBarcodeDataUrl] = useState("");

  // Histories (moat)
  const [passwordHistory, setPasswordHistory] = useState<string[]>([]);
  const [uuidHistory, setUuidHistory] = useState<string[]>([]);
  const [loremHistory, setLoremHistory] = useState<string[]>([]);
  const [qrHistory, setQrHistory] = useState<{ payload: string; dataUrl: string }[]>([]);
  const [barcodeHistory, setBarcodeHistory] = useState<{ text: string; dataUrl: string; format: BarcodeFormat }[]>([]);

  const setSettingsForMoat = (s: Record<string, unknown>) => setSettings(s as MoatSettings);

  const moat = useMoat(settings as Record<string, unknown>, setSettingsForMoat, {
    toolSlug,
    defaultSettings: DEFAULT_SETTINGS as Record<string, unknown>,
    recommendedPresets: RECOMMENDED_PRESETS.map((p) => ({
      id: p.name,
      name: p.name,
      settings: p.settings as Record<string, unknown>,
    })),
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
    moat.recordJob();
  };

  const activeTab = settings.activeTab;

  const qrPayload = useMemo(() => {
    switch (settings.qrTemplate) {
      case "wifi":
        return buildWifiPayload(settings.qrWifiSsid, settings.qrWifiPass, settings.qrWifiAuth, settings.qrWifiHidden);
      case "email":
        return buildMailto(settings.qrEmailTo, settings.qrEmailSubject, settings.qrEmailBody);
      case "sms":
        return buildSms(settings.qrSmsTo, settings.qrSmsBody);
      case "vcard":
        return buildVCard(
          settings.qrVcardName,
          settings.qrVcardOrg,
          settings.qrVcardPhone,
          settings.qrVcardEmail,
          settings.qrVcardUrl,
        );
      default:
        return settings.qrText;
    }
  }, [settings]);

  // Password generator (moat: guarantee at least 1 from each selected type)
  const generatePassword = () => {
    const chars = buildPasswordChars(settings);
    if (!chars) {
      toast({ title: "Select at least one character type", variant: "destructive" });
      return;
    }

    const buckets: string[] = [];
    if (settings.includeUppercase) buckets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    if (settings.includeLowercase) buckets.push("abcdefghijklmnopqrstuvwxyz");
    if (settings.includeNumbers) buckets.push("0123456789");
    if (settings.includeSymbols) buckets.push("!@#$%^&*()_+-=[]{}|;:,.<>?");

    const len = settings.passwordLength;

    let out: string[] = [];

    if (settings.mustIncludeEachSelected && buckets.length > 0) {
      if (len < buckets.length) {
        toast({
          title: "Length too short",
          description: `Length must be at least ${buckets.length} to include each selected type.`,
          variant: "destructive",
        });
        return;
      }
      // 1 from each bucket
      out = buckets.map((b) => pickRandom(b));
    }

    while (out.length < len) out.push(pickRandom(chars));
    shuffle(out);

    const password = out.join("");
    setGeneratedPassword(password);
    setPasswordHistory((h) => [password, ...h].slice(0, MAX_HISTORY));
    moat.recordJob();
  };

  const generateUUIDs = () => {
    const uuids: string[] = [];
    for (let i = 0; i < settings.uuidCount; i++) uuids.push(crypto.randomUUID());
    setGeneratedUUIDs(uuids);
    setUuidHistory((h) => [uuids.join("\n"), ...h].slice(0, MAX_HISTORY));
    moat.recordJob();
  };

  const generateLorem = () => {
    const text = generateLoremText(settings.loremParagraphs);
    setGeneratedLorem(text);
    setLoremHistory((h) => [text, ...h].slice(0, MAX_HISTORY));
    moat.recordJob();
  };

  const generateQRCode = async () => {
    const payload = (qrPayload || "").trim();
    if (!payload) {
      toast({ title: "Please fill the QR fields", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await QRCode.toDataURL(payload, {
        width: settings.qrSize,
        margin: settings.qrMargin,
        errorCorrectionLevel: settings.qrEcc,
      });
      setQrDataUrl(dataUrl);
      setQrHistory((h) => [{ payload, dataUrl }, ...h].slice(0, MAX_HISTORY));
      moat.recordJob();
    } catch {
      toast({ title: "Failed to generate QR code", variant: "destructive" });
    }
  };

  const generateBarcode = () => {
    const text = settings.barcodeText.trim();
    if (!text) {
      toast({ title: "Enter text for barcode", variant: "destructive" });
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, text, {
        format: settings.barcodeFormat,
        width: settings.barcodeWidth,
        height: settings.barcodeHeight,
        displayValue: true,
      });
      const dataUrl = canvas.toDataURL();
      setBarcodeDataUrl(dataUrl);
      setBarcodeHistory((h) => [{ text, dataUrl, format: settings.barcodeFormat }, ...h].slice(0, MAX_HISTORY));
      moat.recordJob();
    } catch {
      toast({ title: "Failed to generate barcode (check format & input)", variant: "destructive" });
    }
  };

  const downloadCurrent = () => {
    if (activeTab === "password" && generatedPassword) {
      downloadText("password.txt", generatedPassword);
      moat.recordJob();
      return;
    }
    if (activeTab === "uuid" && generatedUUIDs.length) {
      downloadText("uuids.txt", generatedUUIDs.join("\n"));
      moat.recordJob();
      return;
    }
    if (activeTab === "lorem" && generatedLorem) {
      downloadText("lorem.txt", generatedLorem);
      moat.recordJob();
      return;
    }
    if (activeTab === "qrcode" && qrDataUrl) {
      downloadImage(qrDataUrl, "qrcode.png");
      moat.recordJob();
      return;
    }
    if (activeTab === "barcode" && barcodeDataUrl) {
      downloadImage(barcodeDataUrl, "barcode.png");
      moat.recordJob();
      return;
    }
    toast({ title: "Nothing to download yet", variant: "destructive" });
  };

  const clearHistory = () => {
    setPasswordHistory([]);
    setUuidHistory([]);
    setLoremHistory([]);
    setQrHistory([]);
    setBarcodeHistory([]);
    toast({ title: "History cleared" });
    moat.recordJob();
  };

  return (
    <ToolLayout
      title="Generator Tools"
      description="QR codes, passwords, UUIDs, lorem ipsum, barcodes — all in one place"
    >
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Moat column */}
        <div className="order-3 lg:order-1">
          <LocalStatusIndicator />
          <div className="mt-3">
            <PresetsPanel
              userPresets={moat.userPresets}
              recommendedPresets={moat.recommendedPresets}
              isLoading={moat.isLoadingPresets}
              onApply={moat.applyPreset}
              onSave={moat.saveCurrentAsPreset}
              onRename={moat.renamePreset}
              onDelete={moat.deletePreset}
              onTogglePinned={moat.togglePinned}
              onUseLastSettings={moat.useLastSettings}
              onReset={moat.resetToDefaults}
            />
          </div>
          <div className="mt-3">
            <CopyLinkButton toolSlug={toolSlug} currentSettings={settings} />
          </div>

          <Card className="p-4 mt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">History</div>
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {activeTab === "password" && (
                <div className="space-y-2">
                  {passwordHistory.length ? (
                    passwordHistory.slice(0, 6).map((p, i) => (
                      <button
                        key={i}
                        className="w-full text-left text-xs rounded-md border px-3 py-2 hover:bg-muted"
                        onClick={() => copyToClipboard(p)}
                      >
                        <span className="font-mono break-all">{p}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No passwords yet.</p>
                  )}
                </div>
              )}

              {activeTab === "uuid" && (
                <div className="space-y-2">
                  {uuidHistory.length ? (
                    uuidHistory.slice(0, 6).map((block, i) => (
                      <button
                        key={i}
                        className="w-full text-left text-xs rounded-md border px-3 py-2 hover:bg-muted"
                        onClick={() => copyToClipboard(block)}
                      >
                        <span className="font-mono break-all">
                          {block.split("\n")[0]}
                          {block.includes("\n") ? " …" : ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No UUID batches yet.</p>
                  )}
                </div>
              )}

              {activeTab === "lorem" && (
                <div className="space-y-2">
                  {loremHistory.length ? (
                    loremHistory.slice(0, 4).map((t, i) => (
                      <button
                        key={i}
                        className="w-full text-left text-xs rounded-md border px-3 py-2 hover:bg-muted"
                        onClick={() => copyToClipboard(t)}
                      >
                        <span className="line-clamp-3">{t}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No lorem yet.</p>
                  )}
                </div>
              )}

              {activeTab === "qrcode" && (
                <div className="space-y-2">
                  {qrHistory.length ? (
                    qrHistory.slice(0, 4).map((q, i) => (
                      <button
                        key={i}
                        className="w-full text-left text-xs rounded-md border px-3 py-2 hover:bg-muted"
                        onClick={() => {
                          setQrDataUrl(q.dataUrl);
                          copyToClipboard(q.payload);
                        }}
                      >
                        <span className="break-all">{q.payload}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No QR codes yet.</p>
                  )}
                </div>
              )}

              {activeTab === "barcode" && (
                <div className="space-y-2">
                  {barcodeHistory.length ? (
                    barcodeHistory.slice(0, 4).map((b, i) => (
                      <button
                        key={i}
                        className="w-full text-left text-xs rounded-md border px-3 py-2 hover:bg-muted"
                        onClick={() => {
                          setBarcodeDataUrl(b.dataUrl);
                          copyToClipboard(b.text);
                        }}
                      >
                        <span className="text-muted-foreground mr-1">{b.format}</span>
                        <span className="font-mono break-all">{b.text}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No barcodes yet.</p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Main */}
        <div className="order-1 lg:order-2 lg:col-span-2">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <Tabs
                value={settings.activeTab}
                onValueChange={(v) => setSettings((p) => ({ ...p, activeTab: v as any }))}
                className="w-full"
              >
                <TabsList className="w-full mb-6 flex overflow-x-auto gap-1 p-1 scrollbar-hide">
                  <TabsTrigger value="password" className="flex-1 min-w-max gap-2">
                    <Key className="h-4 w-4" />
                    <span className="hidden sm:inline">Password</span>
                  </TabsTrigger>
                  <TabsTrigger value="uuid" className="flex-1 min-w-max gap-2">
                    <Hash className="h-4 w-4" />
                    <span className="hidden sm:inline">UUID</span>
                  </TabsTrigger>
                  <TabsTrigger value="lorem" className="flex-1 min-w-max gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Lorem</span>
                  </TabsTrigger>
                  <TabsTrigger value="qrcode" className="flex-1 min-w-max gap-2">
                    <QrCode className="h-4 w-4" />
                    <span className="hidden sm:inline">QR Code</span>
                  </TabsTrigger>
                  <TabsTrigger value="barcode" className="flex-1 min-w-max gap-2">
                    <Barcode className="h-4 w-4" />
                    <span className="hidden sm:inline">Barcode</span>
                  </TabsTrigger>
                </TabsList>

                {/* Password */}
                <TabsContent value="password" className="space-y-5 sm:space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Password Length: {settings.passwordLength}</Label>
                      <Slider
                        value={[settings.passwordLength]}
                        onValueChange={(v) => setSettings((p) => ({ ...p, passwordLength: v[0] }))}
                        min={8}
                        max={64}
                        step={1}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="uppercase"
                          checked={settings.includeUppercase}
                          onCheckedChange={(c) => setSettings((p) => ({ ...p, includeUppercase: !!c }))}
                        />
                        <Label htmlFor="uppercase" className="text-sm sm:text-base">
                          Uppercase (A-Z)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="lowercase"
                          checked={settings.includeLowercase}
                          onCheckedChange={(c) => setSettings((p) => ({ ...p, includeLowercase: !!c }))}
                        />
                        <Label htmlFor="lowercase" className="text-sm sm:text-base">
                          Lowercase (a-z)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="numbers"
                          checked={settings.includeNumbers}
                          onCheckedChange={(c) => setSettings((p) => ({ ...p, includeNumbers: !!c }))}
                        />
                        <Label htmlFor="numbers" className="text-sm sm:text-base">
                          Numbers (0-9)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="symbols"
                          checked={settings.includeSymbols}
                          onCheckedChange={(c) => setSettings((p) => ({ ...p, includeSymbols: !!c }))}
                        />
                        <Label htmlFor="symbols" className="text-sm sm:text-base">
                          Symbols (!@#$...)
                        </Label>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={settings.mustIncludeEachSelected}
                        onCheckedChange={(v) => setSettings((p) => ({ ...p, mustIncludeEachSelected: !!v }))}
                      />
                      Must include each selected type (stronger password)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={generatePassword} className="w-full h-11">
                        <RefreshCw className="mr-2 h-4 w-4" /> Generate
                      </Button>
                      <Button variant="outline" onClick={downloadCurrent} className="w-full h-11">
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>

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

                {/* UUID */}
                <TabsContent value="uuid" className="space-y-5 sm:space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Number of UUIDs: {settings.uuidCount}</Label>
                      <Slider
                        value={[settings.uuidCount]}
                        onValueChange={(v) => setSettings((p) => ({ ...p, uuidCount: v[0] }))}
                        min={1}
                        max={50}
                        step={1}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={generateUUIDs} className="w-full h-11">
                        <RefreshCw className="mr-2 h-4 w-4" /> Generate
                      </Button>
                      <Button variant="outline" onClick={downloadCurrent} className="w-full h-11">
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>

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

                {/* Lorem */}
                <TabsContent value="lorem" className="space-y-5 sm:space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Number of Paragraphs: {settings.loremParagraphs}</Label>
                      <Slider
                        value={[settings.loremParagraphs]}
                        onValueChange={(v) => setSettings((p) => ({ ...p, loremParagraphs: v[0] }))}
                        min={1}
                        max={20}
                        step={1}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={generateLorem} className="w-full h-11">
                        <RefreshCw className="mr-2 h-4 w-4" /> Generate
                      </Button>
                      <Button variant="outline" onClick={downloadCurrent} className="w-full h-11">
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>

                    {generatedLorem && (
                      <div className="space-y-2">
                        <Textarea
                          value={generatedLorem}
                          readOnly
                          rows={10}
                          className="font-mono text-xs sm:text-sm leading-relaxed"
                        />
                        <Button
                          variant="outline"
                          className="w-full h-11"
                          onClick={() => copyToClipboard(generatedLorem)}
                        >
                          <Copy className="mr-2 h-4 w-4" /> Copy Text
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* QR */}
                <TabsContent value="qrcode" className="space-y-5 sm:space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>QR Template</Label>
                      <select
                        className="w-full h-11 rounded-md border bg-background px-3 text-sm"
                        value={settings.qrTemplate}
                        onChange={(e) => setSettings((p) => ({ ...p, qrTemplate: e.target.value as QRTemplate }))}
                      >
                        <option value="text">Text / URL</option>
                        <option value="wifi">Wi-Fi</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="vcard">vCard</option>
                      </select>
                    </div>

                    {settings.qrTemplate === "text" && (
                      <div className="space-y-2">
                        <Label>Text or URL</Label>
                        <Input
                          value={settings.qrText}
                          onChange={(e) => setSettings((p) => ({ ...p, qrText: e.target.value }))}
                          className="h-11"
                        />
                      </div>
                    )}

                    {settings.qrTemplate === "wifi" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Network name (SSID)</Label>
                          <Input
                            value={settings.qrWifiSsid}
                            onChange={(e) => setSettings((p) => ({ ...p, qrWifiSsid: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <Input
                            value={settings.qrWifiPass}
                            onChange={(e) => setSettings((p) => ({ ...p, qrWifiPass: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Auth</Label>
                          <select
                            className="w-full h-11 rounded-md border bg-background px-3 text-sm"
                            value={settings.qrWifiAuth}
                            onChange={(e) => setSettings((p) => ({ ...p, qrWifiAuth: e.target.value as any }))}
                          >
                            <option value="WPA">WPA/WPA2</option>
                            <option value="WEP">WEP</option>
                            <option value="nopass">No password</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <Checkbox
                            checked={settings.qrWifiHidden}
                            onCheckedChange={(v) => setSettings((p) => ({ ...p, qrWifiHidden: !!v }))}
                          />
                          Hidden network
                        </label>
                      </div>
                    )}

                    {settings.qrTemplate === "email" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>To</Label>
                          <Input
                            value={settings.qrEmailTo}
                            onChange={(e) => setSettings((p) => ({ ...p, qrEmailTo: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Input
                            value={settings.qrEmailSubject}
                            onChange={(e) => setSettings((p) => ({ ...p, qrEmailSubject: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Body</Label>
                          <Textarea
                            value={settings.qrEmailBody}
                            onChange={(e) => setSettings((p) => ({ ...p, qrEmailBody: e.target.value }))}
                            rows={4}
                          />
                        </div>
                      </div>
                    )}

                    {settings.qrTemplate === "sms" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={settings.qrSmsTo}
                            onChange={(e) => setSettings((p) => ({ ...p, qrSmsTo: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Message</Label>
                          <Textarea
                            value={settings.qrSmsBody}
                            onChange={(e) => setSettings((p) => ({ ...p, qrSmsBody: e.target.value }))}
                            rows={4}
                          />
                        </div>
                      </div>
                    )}

                    {settings.qrTemplate === "vcard" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Name</Label>
                          <Input
                            value={settings.qrVcardName}
                            onChange={(e) => setSettings((p) => ({ ...p, qrVcardName: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Company</Label>
                          <Input
                            value={settings.qrVcardOrg}
                            onChange={(e) => setSettings((p) => ({ ...p, qrVcardOrg: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={settings.qrVcardPhone}
                            onChange={(e) => setSettings((p) => ({ ...p, qrVcardPhone: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={settings.qrVcardEmail}
                            onChange={(e) => setSettings((p) => ({ ...p, qrVcardEmail: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Website</Label>
                          <Input
                            value={settings.qrVcardUrl}
                            onChange={(e) => setSettings((p) => ({ ...p, qrVcardUrl: e.target.value }))}
                            className="h-11"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Size</Label>
                        <Slider
                          value={[settings.qrSize]}
                          onValueChange={(v) => setSettings((p) => ({ ...p, qrSize: v[0] }))}
                          min={128}
                          max={768}
                          step={16}
                        />
                        <div className="text-xs text-muted-foreground">{settings.qrSize}px</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Margin</Label>
                        <Slider
                          value={[settings.qrMargin]}
                          onValueChange={(v) => setSettings((p) => ({ ...p, qrMargin: v[0] }))}
                          min={0}
                          max={8}
                          step={1}
                        />
                        <div className="text-xs text-muted-foreground">{settings.qrMargin}</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Error correction</Label>
                        <select
                          className="w-full h-11 rounded-md border bg-background px-3 text-sm"
                          value={settings.qrEcc}
                          onChange={(e) => setSettings((p) => ({ ...p, qrEcc: e.target.value as QRErrorCorrection }))}
                        >
                          <option value="L">L (small)</option>
                          <option value="M">M (default)</option>
                          <option value="Q">Q (high)</option>
                          <option value="H">H (max)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={generateQRCode} className="w-full h-11">
                        <RefreshCw className="mr-2 h-4 w-4" /> Generate
                      </Button>
                      <Button variant="outline" onClick={downloadCurrent} className="w-full h-11">
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>

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
                          onClick={() => copyToClipboard(qrPayload)}
                        >
                          <Copy className="mr-2 h-4 w-4" /> Copy payload
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Barcode */}
                <TabsContent value="barcode" className="space-y-5 sm:space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <select
                          className="w-full h-11 rounded-md border bg-background px-3 text-sm"
                          value={settings.barcodeFormat}
                          onChange={(e) =>
                            setSettings((p) => ({ ...p, barcodeFormat: e.target.value as BarcodeFormat }))
                          }
                        >
                          <option value="CODE128">CODE128</option>
                          <option value="EAN13">EAN13</option>
                          <option value="UPC">UPC</option>
                          <option value="ITF">ITF</option>
                          <option value="CODE39">CODE39</option>
                        </select>
                        <p className="text-xs text-muted-foreground">EAN13/UPC require numeric input (fixed length).</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Text</Label>
                        <Input
                          value={settings.barcodeText}
                          onChange={(e) => setSettings((p) => ({ ...p, barcodeText: e.target.value }))}
                          placeholder="Enter text..."
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Bar width: {settings.barcodeWidth}</Label>
                        <Slider
                          value={[settings.barcodeWidth]}
                          onValueChange={(v) => setSettings((p) => ({ ...p, barcodeWidth: v[0] }))}
                          min={1}
                          max={5}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Height: {settings.barcodeHeight}px</Label>
                        <Slider
                          value={[settings.barcodeHeight]}
                          onValueChange={(v) => setSettings((p) => ({ ...p, barcodeHeight: v[0] }))}
                          min={60}
                          max={180}
                          step={10}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={generateBarcode} className="w-full h-11">
                        <RefreshCw className="mr-2 h-4 w-4" /> Generate
                      </Button>
                      <Button variant="outline" onClick={downloadCurrent} className="w-full h-11">
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>

                    {barcodeDataUrl && (
                      <div className="flex flex-col items-center space-y-4">
                        <img
                          src={barcodeDataUrl}
                          alt="Barcode"
                          className="border rounded-lg bg-white p-2 w-full max-w-[420px] h-auto"
                        />
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto h-11"
                          onClick={() => copyToClipboard(settings.barcodeText)}
                        >
                          <Copy className="mr-2 h-4 w-4" /> Copy text
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6">
                <Button variant="outline" className="w-full h-11" onClick={downloadCurrent}>
                  <Download className="mr-2 h-4 w-4" /> Download current output
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolLayout>
  );
};

export default GeneratorTools;
