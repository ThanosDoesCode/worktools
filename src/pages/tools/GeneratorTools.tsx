import React, { useMemo, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, RefreshCw, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

/**
 * GeneratorTools
 * - Password generator (crypto-secure, guarantees at least 1 char from each selected set)
 * - UUID generator (bulk, formatting options)
 * - Lorem generator (paragraphs/sentences/words)
 * - QR code generator (Text/URL, Wi-Fi, vCard, Email, SMS) + PNG + SVG
 * - Barcode generator (CODE128, EAN13, UPC, CODE39) + PNG + SVG
 * - Token/API key generator (hex/base64/url-safe)
 * - Fake test data generator (CSV/JSON)
 */

type QrPreset = "text" | "wifi" | "vcard" | "email" | "sms";
type BarcodeFormat = "CODE128" | "EAN13" | "UPC" | "CODE39";
type LoremMode = "paragraphs" | "sentences" | "words";
type TokenMode = "hex" | "base64" | "urlSafe";
type FakeFormat = "csv" | "json";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeFilename(name: string) {
  return (name || "download")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadTextFile(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function b64FromBytes(bytes: Uint8Array) {
  // browser-safe base64 from bytes
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function urlSafeBase64(b64: string) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hexFromBytes(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cryptoPick(pool: string) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return pool[arr[0] % pool.length];
}

function cryptoShuffle(arr: string[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildWiFiPayload(ssid: string, password: string, auth: "WPA" | "WEP" | "nopass", hidden: boolean) {
  // Standard format: WIFI:T:WPA;S:ssid;P:password;H:true;;
  const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
  const t = auth;
  const s = esc(ssid);
  const p = esc(password);
  const h = hidden ? "true" : "false";
  return `WIFI:T:${t};S:${s};P:${p};H:${h};;`;
}

function buildVCardPayload(v: {
  firstName: string;
  lastName: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}) {
  const ln = (s: string) => (s || "").replace(/\r?\n/g, " ");
  // Minimal vCard 3.0
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${ln(v.lastName)};${ln(v.firstName)};;;`,
    `FN:${ln([v.firstName, v.lastName].filter(Boolean).join(" "))}`,
    v.org ? `ORG:${ln(v.org)}` : "",
    v.title ? `TITLE:${ln(v.title)}` : "",
    v.phone ? `TEL;TYPE=CELL:${ln(v.phone)}` : "",
    v.email ? `EMAIL:${ln(v.email)}` : "",
    v.website ? `URL:${ln(v.website)}` : "",
    v.address ? `ADR;TYPE=HOME:;;${ln(v.address)};;;;` : "",
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEmailPayload(email: string, subject: string, body: string) {
  const enc = (s: string) => encodeURIComponent(s || "");
  return `mailto:${encodeURIComponent(email || "")}?subject=${enc(subject)}&body=${enc(body)}`;
}

function buildSmsPayload(phone: string, message: string) {
  // Works in many mobile clients
  const enc = (s: string) => encodeURIComponent(s || "");
  const p = (phone || "").replace(/[^\d+]/g, "");
  return `sms:${p}?body=${enc(message)}`;
}

function randomInt(min: number, max: number) {
  // inclusive min, inclusive max
  const range = max - min + 1;
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return min + (r[0] % range);
}

function pickOne<T>(arr: T[]) {
  return arr[randomInt(0, arr.length - 1)];
}

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    const needs = /[",\n]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

const GeneratorTools = () => {
  const { toast } = useToast();

  // ========== Password ==========
  const [passwordLength, setPasswordLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState("");

  // ========== UUID ==========
  const [generatedUUIDs, setGeneratedUUIDs] = useState<string[]>([]);
  const [uuidCount, setUuidCount] = useState(1);
  const [uuidUppercase, setUuidUppercase] = useState(false);
  const [uuidNoHyphens, setUuidNoHyphens] = useState(false);

  // ========== Lorem ==========
  const [loremMode, setLoremMode] = useState<LoremMode>("paragraphs");
  const [loremCount, setLoremCount] = useState(3);
  const [loremStartClassic, setLoremStartClassic] = useState(true);
  const [generatedLorem, setGeneratedLorem] = useState("");

  // ========== QR ==========
  const [qrPreset, setQrPreset] = useState<QrPreset>("text");
  const [qrText, setQrText] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [qrSize, setQrSize] = useState(256);
  const [qrMargin, setQrMargin] = useState(2);
  const [qrEcc, setQrEcc] = useState<"L" | "M" | "Q" | "H">("M");

  // Wi-Fi
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiAuth, setWifiAuth] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);

  // vCard
  const [vFirst, setVFirst] = useState("");
  const [vLast, setVLast] = useState("");
  const [vOrg, setVOrg] = useState("");
  const [vTitle, setVTitle] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vWebsite, setVWebsite] = useState("");
  const [vAddress, setVAddress] = useState("");

  // Email
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");

  // SMS
  const [smsPhone, setSmsPhone] = useState("");
  const [smsBody, setSmsBody] = useState("");

  // ========== Barcode ==========
  const [barcodeText, setBarcodeText] = useState("");
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>("CODE128");
  const [barcodeDataUrl, setBarcodeDataUrl] = useState(""); // PNG
  const [barcodeSvg, setBarcodeSvg] = useState(""); // SVG string
  const [barcodeWidth, setBarcodeWidth] = useState(2);
  const [barcodeHeight, setBarcodeHeight] = useState(100);
  const [barcodeDisplayValue, setBarcodeDisplayValue] = useState(true);

  // ========== Token / API Key ==========
  const [tokenLength, setTokenLength] = useState(32);
  const [tokenMode, setTokenMode] = useState<TokenMode>("urlSafe");
  const [generatedToken, setGeneratedToken] = useState("");

  // ========== Fake Data ==========
  const [fakeRows, setFakeRows] = useState(10);
  const [fakeFormat, setFakeFormat] = useState<FakeFormat>("csv");
  const [fakeIncludeName, setFakeIncludeName] = useState(true);
  const [fakeIncludeEmail, setFakeIncludeEmail] = useState(true);
  const [fakeIncludePhone, setFakeIncludePhone] = useState(true);
  const [fakeIncludeCompany, setFakeIncludeCompany] = useState(true);
  const [fakeIncludeCountry, setFakeIncludeCountry] = useState(true);
  const [fakeOutput, setFakeOutput] = useState("");

  const loremWords = useMemo(
    () => [
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
    ],
    [],
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  };

  // ===========================
  // Password Generator (secure)
  // ===========================
  const generatePassword = () => {
    const sets: string[] = [];
    if (includeUppercase) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    if (includeLowercase) sets.push("abcdefghijklmnopqrstuvwxyz");
    if (includeNumbers) sets.push("0123456789");
    if (includeSymbols) sets.push("!@#$%^&*()_+-=[]{}|;:,.<>?");

    if (sets.length === 0) {
      toast({ title: "Please select at least one character type", variant: "destructive" });
      return;
    }

    const len = clamp(passwordLength, 8, 64);
    const all = sets.join("");

    // Ensure at least one from each set
    const out: string[] = sets.map((s) => cryptoPick(s));

    // Fill remainder
    while (out.length < len) out.push(cryptoPick(all));

    // Shuffle for randomness
    cryptoShuffle(out);

    setGeneratedPassword(out.join(""));
  };

  // ===========================
  // UUID Generator
  // ===========================
  const generateUUIDs = () => {
    const count = clamp(uuidCount, 1, 50);
    const uuids: string[] = [];
    for (let i = 0; i < count; i++) {
      let u: string = crypto.randomUUID();
      if (uuidNoHyphens) u = u.replace(/-/g, "");
      if (uuidUppercase) u = u.toUpperCase();
      uuids.push(u);
    }
    setGeneratedUUIDs(uuids);
  };

  // ===========================
  // Lorem Generator
  // ===========================
  const makeSentence = () => {
    const wordCount = randomInt(8, 16);
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) words.push(pickOne(loremWords));
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(" ") + ".";
  };

  const generateLorem = () => {
    const count = clamp(loremCount, 1, 50);

    if (loremMode === "words") {
      const words: string[] = [];
      for (let i = 0; i < count; i++) words.push(pickOne(loremWords));
      if (loremStartClassic && words.length >= 2) {
        words[0] = "lorem";
        words[1] = "ipsum";
      }
      const txt = words.join(" ");
      setGeneratedLorem(txt.charAt(0).toUpperCase() + txt.slice(1));
      return;
    }

    if (loremMode === "sentences") {
      const sentences: string[] = [];
      for (let i = 0; i < count; i++) sentences.push(makeSentence());
      let txt = sentences.join(" ");
      if (loremStartClassic) txt = "Lorem ipsum dolor sit amet. " + txt;
      setGeneratedLorem(txt.trim());
      return;
    }

    // paragraphs
    const paragraphs: string[] = [];
    for (let p = 0; p < count; p++) {
      const sentenceCount = randomInt(4, 7);
      const sentences: string[] = [];
      for (let s = 0; s < sentenceCount; s++) sentences.push(makeSentence());
      paragraphs.push(sentences.join(" "));
    }
    let txt = paragraphs.join("\n\n");
    if (loremStartClassic) txt = "Lorem ipsum dolor sit amet.\n\n" + txt;
    setGeneratedLorem(txt.trim());
  };

  // ===========================
  // QR Generator (PNG + SVG)
  // ===========================
  const qrPayload = useMemo(() => {
    switch (qrPreset) {
      case "wifi":
        if (!wifiSsid.trim()) return "";
        return buildWiFiPayload(wifiSsid.trim(), wifiPassword, wifiAuth, wifiHidden);
      case "vcard":
        if (!vFirst.trim() && !vLast.trim() && !vPhone.trim() && !vEmail.trim()) return "";
        return buildVCardPayload({
          firstName: vFirst.trim(),
          lastName: vLast.trim(),
          org: vOrg.trim(),
          title: vTitle.trim(),
          phone: vPhone.trim(),
          email: vEmail.trim(),
          website: vWebsite.trim(),
          address: vAddress.trim(),
        });
      case "email":
        if (!mailTo.trim()) return "";
        return buildEmailPayload(mailTo.trim(), mailSubject, mailBody);
      case "sms":
        if (!smsPhone.trim()) return "";
        return buildSmsPayload(smsPhone.trim(), smsBody);
      default:
        return qrText.trim();
    }
  }, [
    qrPreset,
    qrText,
    wifiSsid,
    wifiPassword,
    wifiAuth,
    wifiHidden,
    vFirst,
    vLast,
    vOrg,
    vTitle,
    vPhone,
    vEmail,
    vWebsite,
    vAddress,
    mailTo,
    mailSubject,
    mailBody,
    smsPhone,
    smsBody,
  ]);

  const generateQRCode = async () => {
    if (!qrPayload.trim()) {
      toast({ title: "Please fill in the required fields", variant: "destructive" });
      return;
    }

    try {
      const size = clamp(qrSize, 128, 1024);
      const margin = clamp(qrMargin, 0, 10);

      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: size,
        margin,
        errorCorrectionLevel: qrEcc,
      });

      const svgString = await QRCode.toString(qrPayload, {
        type: "svg",
        margin,
        errorCorrectionLevel: qrEcc,
      });

      setQrDataUrl(dataUrl);
      setQrSvg(svgString);

      toast({ title: "QR code generated!" });
    } catch (e: any) {
      toast({
        title: "Failed to generate QR code",
        description: e?.message ? String(e.message) : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // ===========================
  // Barcode Generator (PNG + SVG)
  // ===========================
  const validateBarcodeInput = (format: BarcodeFormat, value: string) => {
    const v = value.trim();
    if (!v) return "Please enter text for barcode.";

    if (format === "EAN13") {
      if (!/^\d{13}$/.test(v)) return "EAN-13 must be exactly 13 digits.";
    }
    if (format === "UPC") {
      if (!/^\d{12}$/.test(v)) return "UPC must be exactly 12 digits.";
    }
    // CODE39 generally expects uppercase alphanumerics + - . space $ / + %
    if (format === "CODE39") {
      if (!/^[0-9A-Z\-.\s$/+%]*$/.test(v.toUpperCase())) return "CODE39 supports A–Z, 0–9 and - . space $ / + %";
    }

    return null;
  };

  const generateBarcode = () => {
    const err = validateBarcodeInput(barcodeFormat, barcodeText);
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }

    try {
      const text = barcodeFormat === "CODE39" ? barcodeText.trim().toUpperCase() : barcodeText.trim();

      // PNG via canvas
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, text, {
        format: barcodeFormat,
        width: clamp(barcodeWidth, 1, 5),
        height: clamp(barcodeHeight, 40, 200),
        displayValue: barcodeDisplayValue,
        margin: 10,
      });
      setBarcodeDataUrl(canvas.toDataURL("image/png"));

      // SVG (crisp)
      const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svgNode as any, text, {
        format: barcodeFormat,
        width: clamp(barcodeWidth, 1, 5),
        height: clamp(barcodeHeight, 40, 200),
        displayValue: barcodeDisplayValue,
        margin: 10,
      });
      setBarcodeSvg(svgNode.outerHTML);

      toast({ title: "Barcode generated!" });
    } catch (e: any) {
      toast({
        title: "Failed to generate barcode",
        description: e?.message ? String(e.message) : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // ===========================
  // Token / API Key Generator
  // ===========================
  const generateToken = () => {
    const len = clamp(tokenLength, 8, 256);

    // bytes needed depends on encoding
    // hex: 2 chars per byte
    // base64: ~4 chars per 3 bytes
    let bytesNeeded = len;
    if (tokenMode === "hex") bytesNeeded = Math.ceil(len / 2);
    if (tokenMode === "base64" || tokenMode === "urlSafe") bytesNeeded = Math.ceil((len * 3) / 4);

    const bytes = new Uint8Array(bytesNeeded);
    crypto.getRandomValues(bytes);

    let token = "";
    if (tokenMode === "hex") token = hexFromBytes(bytes).slice(0, len);
    else {
      const b64 = b64FromBytes(bytes);
      token = (tokenMode === "urlSafe" ? urlSafeBase64(b64) : b64).slice(0, len);
    }

    setGeneratedToken(token);
  };

  // ===========================
  // Fake Test Data Generator
  // ===========================
  const firstNames = useMemo(
    () => ["Alex", "Sam", "Chris", "Taylor", "Jordan", "Morgan", "Jamie", "Casey", "Pat", "Drew"],
    [],
  );
  const lastNames = useMemo(
    () => ["Smith", "Johnson", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas"],
    [],
  );
  const companies = useMemo(
    () => ["Acme Co", "BluePeak", "Northwind", "Nimbus Labs", "Horizon Group", "Vertex.io", "Evergreen", "Atlas Works"],
    [],
  );
  const countries = useMemo(
    () => ["Sweden", "Greece", "Germany", "France", "Spain", "UK", "USA", "Canada", "Netherlands", "Italy"],
    [],
  );

  const generateFakeData = () => {
    const rowsCount = clamp(fakeRows, 1, 500);

    const cols = {
      name: fakeIncludeName,
      email: fakeIncludeEmail,
      phone: fakeIncludePhone,
      company: fakeIncludeCompany,
      country: fakeIncludeCountry,
    };

    if (!Object.values(cols).some(Boolean)) {
      toast({ title: "Select at least one column", variant: "destructive" });
      return;
    }

    const rows: Record<string, any>[] = [];
    for (let i = 0; i < rowsCount; i++) {
      const fn = pickOne(firstNames);
      const ln = pickOne(lastNames);
      const name = `${fn} ${ln}`;
      const domain = "example.com";
      const email = `${fn}.${ln}.${randomInt(10, 9999)}`.toLowerCase() + "@" + domain;
      const phone = `+46${randomInt(700000000, 799999999)}`;
      const company = pickOne(companies);
      const country = pickOne(countries);

      const row: Record<string, any> = {};
      if (cols.name) row.name = name;
      if (cols.email) row.email = email;
      if (cols.phone) row.phone = phone;
      if (cols.company) row.company = company;
      if (cols.country) row.country = country;

      rows.push(row);
    }

    if (fakeFormat === "json") {
      setFakeOutput(JSON.stringify(rows, null, 2));
      toast({ title: "Fake data generated (JSON)" });
      return;
    }

    setFakeOutput(toCsv(rows));
    toast({ title: "Fake data generated (CSV)" });
  };

  // ===========================
  // Clear helpers per tab
  // ===========================
  const clearPassword = () => setGeneratedPassword("");
  const clearUUID = () => setGeneratedUUIDs([]);
  const clearLorem = () => setGeneratedLorem("");
  const clearQR = () => {
    setQrDataUrl("");
    setQrSvg("");
  };
  const clearBarcode = () => {
    setBarcodeDataUrl("");
    setBarcodeSvg("");
  };
  const clearToken = () => setGeneratedToken("");
  const clearFake = () => setFakeOutput("");

  return (
    <ToolLayout
      title="Generator Tools"
      description="QR codes, passwords, UUIDs, lorem ipsum, barcodes, tokens, fake test data — all in one place"
    >
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 mb-6 gap-2">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="uuid">UUID</TabsTrigger>
              <TabsTrigger value="lorem">Lorem</TabsTrigger>
              <TabsTrigger value="qrcode">QR</TabsTrigger>
              <TabsTrigger value="barcode">Barcode</TabsTrigger>
              <TabsTrigger value="token">Token</TabsTrigger>
              <TabsTrigger value="fake">Fake Data</TabsTrigger>
            </TabsList>

            {/* ================= Password ================= */}
            <TabsContent value="password" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Password Length: {passwordLength}</Label>
                  <Slider
                    value={[passwordLength]}
                    onValueChange={(v) => setPasswordLength(clamp(v[0] ?? 16, 8, 64))}
                    min={8}
                    max={64}
                    step={1}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="uppercase"
                      checked={includeUppercase}
                      onCheckedChange={(c) => setIncludeUppercase(!!c)}
                    />
                    <Label htmlFor="uppercase">Uppercase (A-Z)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="lowercase"
                      checked={includeLowercase}
                      onCheckedChange={(c) => setIncludeLowercase(!!c)}
                    />
                    <Label htmlFor="lowercase">Lowercase (a-z)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="numbers" checked={includeNumbers} onCheckedChange={(c) => setIncludeNumbers(!!c)} />
                    <Label htmlFor="numbers">Numbers (0-9)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="symbols" checked={includeSymbols} onCheckedChange={(c) => setIncludeSymbols(!!c)} />
                    <Label htmlFor="symbols">Symbols (!@#$...)</Label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={generatePassword} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate
                  </Button>
                  <Button onClick={clearPassword} variant="secondary" className="w-full" disabled={!generatedPassword}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>

                {generatedPassword && (
                  <div className="p-4 bg-muted rounded-lg flex items-center justify-between gap-3">
                    <code className="text-sm break-all">{generatedPassword}</code>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(generatedPassword)}
                        aria-label="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadTextFile(generatedPassword, "password.txt")}
                        aria-label="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Uses <span className="font-medium text-foreground">crypto.getRandomValues</span> (secure). Guarantees
                  at least 1 character from each selected set.
                </p>
              </div>
            </TabsContent>

            {/* ================= UUID ================= */}
            <TabsContent value="uuid" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Number of UUIDs: {uuidCount}</Label>
                  <Slider
                    value={[uuidCount]}
                    onValueChange={(v) => setUuidCount(clamp(v[0] ?? 1, 1, 50))}
                    min={1}
                    max={50}
                    step={1}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="uuid-up" checked={uuidUppercase} onCheckedChange={(c) => setUuidUppercase(!!c)} />
                    <Label htmlFor="uuid-up">Uppercase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="uuid-nohy" checked={uuidNoHyphens} onCheckedChange={(c) => setUuidNoHyphens(!!c)} />
                    <Label htmlFor="uuid-nohy">Remove hyphens</Label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={generateUUIDs} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate
                  </Button>
                  <Button
                    onClick={clearUUID}
                    variant="secondary"
                    className="w-full"
                    disabled={generatedUUIDs.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>

                {generatedUUIDs.length > 0 && (
                  <div className="space-y-2">
                    {generatedUUIDs.map((uuid, i) => (
                      <div key={i} className="p-3 bg-muted rounded-lg flex items-center justify-between gap-3">
                        <code className="text-sm break-all">{uuid}</code>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(uuid)} aria-label="Copy">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => copyToClipboard(generatedUUIDs.join("\n"))}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copy All
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => downloadTextFile(generatedUUIDs.join("\n"), "uuids.txt")}
                      >
                        <Download className="mr-2 h-4 w-4" /> Download .txt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ================= Lorem ================= */}
            <TabsContent value="lorem" className="space-y-6">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select value={loremMode} onValueChange={(v) => setLoremMode(v as LoremMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paragraphs">Paragraphs</SelectItem>
                        <SelectItem value="sentences">Sentences</SelectItem>
                        <SelectItem value="words">Words</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Count: <span className="font-medium">{loremCount}</span>
                    </Label>
                    <Slider
                      value={[loremCount]}
                      onValueChange={(v) => setLoremCount(clamp(v[0] ?? 3, 1, 50))}
                      min={1}
                      max={50}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lorem-classic"
                    checked={loremStartClassic}
                    onCheckedChange={(c) => setLoremStartClassic(!!c)}
                  />
                  <Label htmlFor="lorem-classic">Start with “Lorem ipsum…”</Label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={generateLorem} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate
                  </Button>
                  <Button onClick={clearLorem} variant="secondary" className="w-full" disabled={!generatedLorem}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>

                {generatedLorem && (
                  <div className="space-y-2">
                    <Textarea value={generatedLorem} readOnly rows={10} className="font-mono text-sm" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="outline" className="w-full" onClick={() => copyToClipboard(generatedLorem)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => downloadTextFile(generatedLorem, "lorem.txt")}
                      >
                        <Download className="mr-2 h-4 w-4" /> Download .txt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ================= QR ================= */}
            <TabsContent value="qrcode" className="space-y-6">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Preset</Label>
                    <Select value={qrPreset} onValueChange={(v) => setQrPreset(v as QrPreset)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text / URL</SelectItem>
                        <SelectItem value="wifi">Wi-Fi</SelectItem>
                        <SelectItem value="vcard">vCard</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Error correction</Label>
                    <Select value={qrEcc} onValueChange={(v) => setQrEcc(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">L (smallest)</SelectItem>
                        <SelectItem value="M">M (default)</SelectItem>
                        <SelectItem value="Q">Q</SelectItem>
                        <SelectItem value="H">H (most robust)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preset Inputs */}
                {qrPreset === "text" && (
                  <div className="space-y-2">
                    <Label htmlFor="qr-text">Text or URL</Label>
                    <Input
                      id="qr-text"
                      value={qrText}
                      onChange={(e) => setQrText(e.target.value)}
                      placeholder="https://example.com or any text..."
                      className="mt-1"
                    />
                  </div>
                )}

                {qrPreset === "wifi" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>SSID</Label>
                      <Input
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        placeholder="Wi-Fi network name"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Security</Label>
                        <Select value={wifiAuth} onValueChange={(v) => setWifiAuth(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WPA">WPA/WPA2</SelectItem>
                            <SelectItem value="WEP">WEP</SelectItem>
                            <SelectItem value="nopass">No password</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          value={wifiPassword}
                          onChange={(e) => setWifiPassword(e.target.value)}
                          placeholder={wifiAuth === "nopass" ? "(not required)" : "Wi-Fi password"}
                          disabled={wifiAuth === "nopass"}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="wifi-hidden" checked={wifiHidden} onCheckedChange={(c) => setWifiHidden(!!c)} />
                      <Label htmlFor="wifi-hidden">Hidden network</Label>
                    </div>
                  </div>
                )}

                {qrPreset === "vcard" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>First name</Label>
                        <Input value={vFirst} onChange={(e) => setVFirst(e.target.value)} placeholder="John" />
                      </div>
                      <div className="space-y-2">
                        <Label>Last name</Label>
                        <Input value={vLast} onChange={(e) => setVLast(e.target.value)} placeholder="Doe" />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Company</Label>
                        <Input value={vOrg} onChange={(e) => setVOrg(e.target.value)} placeholder="Acme Co" />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={vTitle}
                          onChange={(e) => setVTitle(e.target.value)}
                          placeholder="Sales Director"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="+46..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={vEmail}
                          onChange={(e) => setVEmail(e.target.value)}
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Website</Label>
                        <Input
                          value={vWebsite}
                          onChange={(e) => setVWebsite(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                          value={vAddress}
                          onChange={(e) => setVAddress(e.target.value)}
                          placeholder="Street, City"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {qrPreset === "email" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input
                        value={mailTo}
                        onChange={(e) => setMailTo(e.target.value)}
                        placeholder="someone@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} placeholder="Hello" />
                    </div>
                    <div className="space-y-2">
                      <Label>Body</Label>
                      <Textarea
                        value={mailBody}
                        onChange={(e) => setMailBody(e.target.value)}
                        placeholder="Write your message..."
                        rows={4}
                      />
                    </div>
                  </div>
                )}

                {qrPreset === "sms" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="+46..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea
                        value={smsBody}
                        onChange={(e) => setSmsBody(e.target.value)}
                        placeholder="SMS message..."
                        rows={4}
                      />
                    </div>
                  </div>
                )}

                {/* QR style controls */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Size</Label>
                      <span className="text-sm text-muted-foreground">{qrSize}px</span>
                    </div>
                    <Slider
                      value={[qrSize]}
                      onValueChange={(v) => setQrSize(clamp(v[0] ?? 256, 128, 1024))}
                      min={128}
                      max={1024}
                      step={32}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Margin</Label>
                      <span className="text-sm text-muted-foreground">{qrMargin}</span>
                    </div>
                    <Slider
                      value={[qrMargin]}
                      onValueChange={(v) => setQrMargin(clamp(v[0] ?? 2, 0, 10))}
                      min={0}
                      max={10}
                      step={1}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={generateQRCode} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate
                  </Button>
                  <Button onClick={clearQR} variant="secondary" className="w-full" disabled={!qrDataUrl && !qrSvg}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>

                {(qrDataUrl || qrSvg) && (
                  <div className="flex flex-col items-center space-y-4 pt-2">
                    {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="border rounded-lg" />}
                    <div className="grid gap-3 sm:grid-cols-2 w-full">
                      <Button
                        variant="outline"
                        onClick={() => qrDataUrl && downloadDataUrl(qrDataUrl, `${safeFilename(qrPreset)}-qrcode.png`)}
                        disabled={!qrDataUrl}
                        className="w-full"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download PNG
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          qrSvg &&
                          downloadTextFile(qrSvg, `${safeFilename(qrPreset)}-qrcode.svg`, "image/svg+xml;charset=utf-8")
                        }
                        disabled={!qrSvg}
                        className="w-full"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download SVG
                      </Button>
                    </div>

                    <div className="w-full">
                      <Label>Payload preview</Label>
                      <Textarea value={qrPayload} readOnly rows={3} className="mt-1 font-mono text-xs" />
                      <div className="mt-2">
                        <Button variant="outline" className="w-full" onClick={() => copyToClipboard(qrPayload)}>
                          <Copy className="mr-2 h-4 w-4" /> Copy payload
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ================= Barcode ================= */}
            <TabsContent value="barcode" className="space-y-6">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={barcodeFormat} onValueChange={(v) => setBarcodeFormat(v as BarcodeFormat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CODE128">CODE128 (general)</SelectItem>
                        <SelectItem value="EAN13">EAN-13 (13 digits)</SelectItem>
                        <SelectItem value="UPC">UPC (12 digits)</SelectItem>
                        <SelectItem value="CODE39">CODE39</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Text</Label>
                    <Input
                      value={barcodeText}
                      onChange={(e) => setBarcodeText(e.target.value)}
                      placeholder={
                        barcodeFormat === "EAN13"
                          ? "13 digits"
                          : barcodeFormat === "UPC"
                            ? "12 digits"
                            : barcodeFormat === "CODE39"
                              ? "A–Z, 0–9, - . space $ / + %"
                              : "Any text"
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Bar width</Label>
                    <Slider
                      value={[barcodeWidth]}
                      onValueChange={(v) => setBarcodeWidth(clamp(v[0] ?? 2, 1, 5))}
                      min={1}
                      max={5}
                      step={1}
                    />
                    <div className="text-xs text-muted-foreground">Current: {barcodeWidth}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Height</Label>
                    <Slider
                      value={[barcodeHeight]}
                      onValueChange={(v) => setBarcodeHeight(clamp(v[0] ?? 100, 40, 200))}
                      min={40}
                      max={200}
                      step={10}
                    />
                    <div className="text-xs text-muted-foreground">Current: {barcodeHeight}px</div>
                  </div>
                  <div className="flex items-center space-x-2 mt-6">
                    <Checkbox
                      id="barcode-value"
                      checked={barcodeDisplayValue}
                      onCheckedChange={(c) => setBarcodeDisplayValue(!!c)}
                    />
                    <Label htmlFor="barcode-value">Show value</Label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={generateBarcode} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate
                  </Button>
                  <Button
                    onClick={clearBarcode}
                    variant="secondary"
                    className="w-full"
                    disabled={!barcodeDataUrl && !barcodeSvg}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>

                {(barcodeDataUrl || barcodeSvg) && (
                  <div className="flex flex-col items-center space-y-4">
                    {barcodeDataUrl && (
                      <img src={barcodeDataUrl} alt="Barcode" className="border rounded-lg bg-white p-2" />
                    )}
                    <div className="grid gap-3 sm:grid-cols-2 w-full">
                      <Button
                        variant="outline"
                        onClick={() =>
                          barcodeDataUrl &&
                          downloadDataUrl(barcodeDataUrl, `${safeFilename(barcodeFormat)}-barcode.png`)
                        }
                        disabled={!barcodeDataUrl}
                        className="w-full"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download PNG
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          barcodeSvg &&
                          downloadTextFile(
                            barcodeSvg,
                            `${safeFilename(barcodeFormat)}-barcode.svg`,
                            "image/svg+xml;charset=utf-8",
                          )
                        }
                        disabled={!barcodeSvg}
                        className="w-full"
                      >
                        <Download className="mr-2 h-4 w-4" /> Download SVG
                      </Button>
                    </div>

                    <div className="w-full">
                      <Label>SVG preview</Label>
                      <div className="mt-2 rounded-lg border bg-white p-3 overflow-auto">
                        {/* Locally generated SVG from JsBarcode */}
                        <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ================= Token / API Key ================= */}
            <TabsContent value="token" className="space-y-6">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Encoding</Label>
                    <Select value={tokenMode} onValueChange={(v) => setTokenMode(v as TokenMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urlSafe">URL-safe (recommended)</SelectItem>
                        <SelectItem value="base64">Base64</SelectItem>
                        <SelectItem value="hex">Hex</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      URL-safe removes + / = so it’s good for APIs and URLs.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Length: {tokenLength}</Label>
                    <Slider
                      value={[tokenLength]}
                      onValueChange={(v) => setTokenLength(clamp(v[0] ?? 32, 8, 256))}
                      min={8}
                      max={256}
                      step={4}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={generateToken} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate
                  </Button>
                  <Button onClick={clearToken} variant="secondary" className="w-full" disabled={!generatedToken}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>

                {generatedToken && (
                  <div className="p-4 bg-muted rounded-lg flex items-center justify-between gap-3">
                    <code className="text-sm break-all">{generatedToken}</code>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(generatedToken)}
                        aria-label="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadTextFile(generatedToken, "token.txt")}
                        aria-label="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">Generated locally with crypto-secure randomness.</p>
              </div>
            </TabsContent>

            {/* ================= Fake Data ================= */}
            <TabsContent value="fake" className="space-y-6">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Output format</Label>
                    <Select value={fakeFormat} onValueChange={(v) => setFakeFormat(v as FakeFormat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rows: {fakeRows}</Label>
                    <Slider
                      value={[fakeRows]}
                      onValueChange={(v) => setFakeRows(clamp(v[0] ?? 10, 1, 500))}
                      min={1}
                      max={500}
                      step={1}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fake-name"
                      checked={fakeIncludeName}
                      onCheckedChange={(c) => setFakeIncludeName(!!c)}
                    />
                    <Label htmlFor="fake-name">Name</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fake-email"
                      checked={fakeIncludeEmail}
                      onCheckedChange={(c) => setFakeIncludeEmail(!!c)}
                    />
                    <Label htmlFor="fake-email">Email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fake-phone"
                      checked={fakeIncludePhone}
                      onCheckedChange={(c) => setFakeIncludePhone(!!c)}
                    />
                    <Label htmlFor="fake-phone">Phone</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fake-company"
                      checked={fakeIncludeCompany}
                      onCheckedChange={(c) => setFakeIncludeCompany(!!c)}
                    />
                    <Label htmlFor="fake-company">Company</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fake-country"
                      checked={fakeIncludeCountry}
                      onCheckedChange={(c) => setFakeIncludeCountry(!!c)}
                    />
                    <Label htmlFor="fake-country">Country</Label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={generateFakeData} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate
                  </Button>
                  <Button onClick={clearFake} variant="secondary" className="w-full" disabled={!fakeOutput}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </div>

                {fakeOutput && (
                  <div className="space-y-2">
                    <Textarea value={fakeOutput} readOnly rows={12} className="font-mono text-xs" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button variant="outline" className="w-full" onClick={() => copyToClipboard(fakeOutput)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          downloadTextFile(
                            fakeOutput,
                            fakeFormat === "json" ? "fake-data.json" : "fake-data.csv",
                            fakeFormat === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8",
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Tip: CSV is great for spreadsheets; JSON is great for dev/test APIs.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </ToolLayout>
  );
};

export default GeneratorTools;
