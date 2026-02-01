import { useEffect, useMemo, useRef, useState } from "react";
import { ToolLayout } from "@/components/layout/ToolLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Copy, RotateCcw, Upload, Check, Download, QrCode, Sparkles, Trash2, BookmarkPlus } from "lucide-react";
import { toast } from "sonner";

import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SignatureData {
  fullName: string;
  jobTitle: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  brandColor: string;
  logoUrl: string;
}

type LayoutPreset = "classic" | "compact" | "stacked";
type FontPreset = "system" | "arial" | "inter" | "georgia";

type SignaturePreset = {
  id: string;
  name: string;
  kind: "built-in" | "custom";
  data: SignatureData;
  ui: {
    layout: LayoutPreset;
    font: FontPreset;
    fontSize: number; // px
    showIcons: boolean;
    showDivider: boolean;
    dividerWidth: number; // px
    dividerColorMode: "brand" | "neutral";
    linkStyle: "brand" | "underline";
    includeQR: boolean;
    qrValue: "website" | "email" | "linkedin";
  };
};

const PRESETS_KEY = "tool.email_signature.presets.v1";

const defaultData: SignatureData = {
  fullName: "John Smith",
  jobTitle: "Senior Product Manager",
  company: "Acme Corporation",
  phone: "+1 (555) 123-4567",
  email: "john.smith@acme.com",
  website: "www.acme.com",
  linkedin: "johnsmith",
  brandColor: "#2563eb",
  logoUrl: "",
};

const BUILT_IN_PRESETS: SignaturePreset[] = [
  {
    id: "p_classic_brand",
    name: "Classic (brand line)",
    kind: "built-in",
    data: { ...defaultData },
    ui: {
      layout: "classic",
      font: "arial",
      fontSize: 14,
      showIcons: true,
      showDivider: true,
      dividerWidth: 3,
      dividerColorMode: "brand",
      linkStyle: "brand",
      includeQR: false,
      qrValue: "website",
    },
  },
  {
    id: "p_compact_minimal",
    name: "Compact (minimal)",
    kind: "built-in",
    data: { ...defaultData, brandColor: "#111827" },
    ui: {
      layout: "compact",
      font: "system",
      fontSize: 13,
      showIcons: false,
      showDivider: false,
      dividerWidth: 0,
      dividerColorMode: "neutral",
      linkStyle: "underline",
      includeQR: false,
      qrValue: "website",
    },
  },
  {
    id: "p_stacked_modern",
    name: "Stacked (modern)",
    kind: "built-in",
    data: { ...defaultData, brandColor: "#7c3aed" },
    ui: {
      layout: "stacked",
      font: "inter",
      fontSize: 14,
      showIcons: true,
      showDivider: false,
      dividerWidth: 0,
      dividerColorMode: "neutral",
      linkStyle: "brand",
      includeQR: true,
      qrValue: "linkedin",
    },
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function baseName(name: string) {
  return (name || "signature").replace(/\s+/g, "-").toLowerCase();
}

function normalizeWebsite(url: string) {
  const v = (url || "").trim();
  if (!v) return "";
  // if already has protocol, keep it
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function normalizeLinkedIn(usernameOrUrl: string) {
  const v = (usernameOrUrl || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://linkedin.com/in/${v.replace(/^@/, "")}`;
}

function pickFont(font: FontPreset) {
  if (font === "inter") return "Inter, Arial, sans-serif";
  if (font === "georgia") return "Georgia, Times, serif";
  if (font === "arial") return "Arial, sans-serif";
  return "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
}

export default function EmailSignatureGenerator() {
  const [data, setData] = useState<SignatureData>(defaultData);

  // Moat UI controls
  const [layout, setLayout] = useState<LayoutPreset>("classic");
  const [font, setFont] = useState<FontPreset>("arial");
  const [fontSize, setFontSize] = useState<number>(14);
  const [showIcons, setShowIcons] = useState(true);
  const [showDivider, setShowDivider] = useState(true);
  const [dividerWidth, setDividerWidth] = useState<number>(3);
  const [dividerColorMode, setDividerColorMode] = useState<"brand" | "neutral">("brand");
  const [linkStyle, setLinkStyle] = useState<"brand" | "underline">("brand");
  const [includeQR, setIncludeQR] = useState(false);
  const [qrValue, setQrValue] = useState<"website" | "email" | "linkedin">("website");

  // Presets
  const [customPresets, setCustomPresets] = useState<SignaturePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  // Premium dialogs
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [deletePresetOpen, setDeletePresetOpen] = useState(false);
  const [draftPresetName, setDraftPresetName] = useState("My signature preset");
  const [presetToDelete, setPresetToDelete] = useState<string>("");

  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedRich, setCopiedRich] = useState(false);
  const signatureRef = useRef<HTMLDivElement>(null);

  // QR generation
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  const isCustomPresetSelected = useMemo(() => {
    if (!selectedPresetId) return false;
    return customPresets.some((p) => p.id === selectedPresetId);
  }, [selectedPresetId, customPresets]);

  useEffect(() => {
    const stored = safeParse<SignaturePreset[]>(localStorage.getItem(PRESETS_KEY), []);
    setCustomPresets(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  const updateField = (field: keyof SignatureData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const applyPreset = (presetId: string) => {
    const p = allPresets.find((x) => x.id === presetId);
    if (!p) return;
    setData(p.data);

    setLayout(p.ui.layout);
    setFont(p.ui.font);
    setFontSize(p.ui.fontSize);
    setShowIcons(p.ui.showIcons);
    setShowDivider(p.ui.showDivider);
    setDividerWidth(p.ui.dividerWidth);
    setDividerColorMode(p.ui.dividerColorMode);
    setLinkStyle(p.ui.linkStyle);
    setIncludeQR(p.ui.includeQR);
    setQrValue(p.ui.qrValue);

    toast.success(`Preset applied: ${p.name}`);
  };

  const handleReset = () => {
    setData(defaultData);
    setLayout("classic");
    setFont("arial");
    setFontSize(14);
    setShowIcons(true);
    setShowDivider(true);
    setDividerWidth(3);
    setDividerColorMode("brand");
    setLinkStyle("brand");
    setIncludeQR(false);
    setQrValue("website");
    setSelectedPresetId("");
    toast.success("Reset to default");
  };

  const openSavePreset = () => {
    setDraftPresetName("My signature preset");
    setSavePresetOpen(true);
  };

  const savePreset = () => {
    const name = draftPresetName.trim();
    if (!name) {
      toast.error("Please enter a preset name");
      return;
    }
    const p: SignaturePreset = {
      id: uid(),
      name,
      kind: "custom",
      data: { ...data },
      ui: {
        layout,
        font,
        fontSize,
        showIcons,
        showDivider,
        dividerWidth,
        dividerColorMode,
        linkStyle,
        includeQR,
        qrValue,
      },
    };
    setCustomPresets((prev) => [p, ...prev]);
    setSelectedPresetId(p.id);
    setSavePresetOpen(false);
    toast.success("Preset saved (local)");
  };

  const requestDeletePreset = () => {
    if (!selectedPresetId) return;
    const p = allPresets.find((x) => x.id === selectedPresetId);
    if (!p || p.kind !== "custom") return;
    setPresetToDelete(selectedPresetId);
    setDeletePresetOpen(true);
  };

  const deletePreset = () => {
    const id = presetToDelete;
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    if (selectedPresetId === id) setSelectedPresetId("");
    setPresetToDelete("");
    setDeletePresetOpen(false);
    toast.success("Preset deleted");
  };

  const handleCopyHtml = async () => {
    if (!signatureRef.current) return;
    const html = signatureRef.current.innerHTML;
    await navigator.clipboard.writeText(html);
    setCopiedHtml(true);
    toast.success("HTML signature copied to clipboard");
    setTimeout(() => setCopiedHtml(false), 1500);
  };

  const handleCopyRichText = async () => {
    if (!signatureRef.current) return;

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(signatureRef.current);
    selection?.removeAllRanges();
    selection?.addRange(range);

    try {
      document.execCommand("copy");
      setCopiedRich(true);
      toast.success("Rich text copied! Paste into Gmail/Outlook signature settings.");
      setTimeout(() => setCopiedRich(false), 1500);
    } catch {
      toast.error("Failed to copy. Please select and copy manually.");
    }
    selection?.removeAllRanges();
  };

  const handleDownloadHtmlFile = () => {
    if (!signatureRef.current) return;
    const html = signatureRef.current.innerHTML;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(data.fullName || "signature")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded HTML file");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => updateField("logoUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  // QR value selection (moat)
  const qrPayload = useMemo(() => {
    if (!includeQR) return "";
    if (qrValue === "email") return data.email ? `mailto:${data.email}` : "";
    if (qrValue === "linkedin") return data.linkedin ? normalizeLinkedIn(data.linkedin) : "";
    return data.website ? normalizeWebsite(data.website) : "";
  }, [includeQR, qrValue, data.email, data.linkedin, data.website]);

  useEffect(() => {
    let alive = true;
    async function gen() {
      if (!qrPayload) {
        setQrDataUrl("");
        return;
      }
      try {
        const url = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 5 });
        if (alive) setQrDataUrl(url);
      } catch {
        if (alive) setQrDataUrl("");
      }
    }
    gen();
    return () => {
      alive = false;
    };
  }, [qrPayload]);

  const linkColor = linkStyle === "brand" ? data.brandColor : "#111827";
  const linkDecoration = linkStyle === "underline" ? "underline" : "none";

  const dividerColor = dividerColorMode === "brand" ? data.brandColor : "#e5e7eb";
  const fontFamily = pickFont(font);

  const icons = useMemo(() => {
    if (!showIcons) {
      return { phone: "", email: "", web: "", li: "" };
    }
    // Keep emoji simple (max compatibility in email clients)
    return { phone: "📞 ", email: "✉️ ", web: "🌐 ", li: "💼 " };
  }, [showIcons]);

  const SmartFill = () => {
    setData((prev) => ({
      ...prev,
      fullName: prev.fullName || "Your Name",
      jobTitle: prev.jobTitle || "Your Title",
      company: prev.company || "Your Company",
      phone: prev.phone || "+1 (000) 000-0000",
      email: prev.email || "you@company.com",
      website: prev.website || "company.com",
      linkedin: prev.linkedin || "yourlinkedin",
    }));
    toast.success("Filled missing fields");
  };

  // Signature blocks
  const signatureTable = useMemo(() => {
    const websiteHref = data.website ? normalizeWebsite(data.website) : "";
    const linkedinHref = data.linkedin ? normalizeLinkedIn(data.linkedin) : "";

    const nameEl = (
      <span style={{ fontWeight: 700, fontSize: `${fontSize + 2}px`, color: data.brandColor }}>{data.fullName}</span>
    );

    const roleEl = (
      <span style={{ color: "#6b7280" }}>
        {data.jobTitle} {data.company && `| ${data.company}`}
      </span>
    );

    const contactRows: Array<JSX.Element | null> = [
      data.phone ? (
        <tr key="phone">
          <td style={{ paddingBottom: "4px" }}>
            <span style={{ color: "#111827" }}>
              {icons.phone}
              {data.phone}
            </span>
          </td>
        </tr>
      ) : null,
      data.email ? (
        <tr key="email">
          <td style={{ paddingBottom: "4px" }}>
            <a href={`mailto:${data.email}`} style={{ color: linkColor, textDecoration: linkDecoration }}>
              {icons.email}
              {data.email}
            </a>
          </td>
        </tr>
      ) : null,
      data.website ? (
        <tr key="web">
          <td style={{ paddingBottom: "4px" }}>
            <a href={websiteHref} style={{ color: linkColor, textDecoration: linkDecoration }}>
              {icons.web}
              {data.website}
            </a>
          </td>
        </tr>
      ) : null,
      data.linkedin ? (
        <tr key="li">
          <td>
            <a href={linkedinHref} style={{ color: "#0077b5", textDecoration: "none" }}>
              {icons.li}LinkedIn
            </a>
          </td>
        </tr>
      ) : null,
    ].filter(Boolean);

    const leftLogoCell = data.logoUrl ? (
      <td style={{ paddingRight: "16px", verticalAlign: "top" }}>
        <img src={data.logoUrl} alt="Company Logo" style={{ width: "80px", height: "auto", borderRadius: "6px" }} />
      </td>
    ) : null;

    const dividerStyle =
      data.logoUrl && showDivider
        ? {
            borderLeft: `${dividerWidth}px solid ${dividerColor}`,
            paddingLeft: "16px",
          }
        : { borderLeft: "none", paddingLeft: data.logoUrl ? "16px" : "0" };

    // Layout variations
    if (layout === "stacked") {
      return (
        <table
          cellPadding="0"
          cellSpacing="0"
          style={{
            fontFamily,
            fontSize: `${fontSize}px`,
            color: "#111827",
            lineHeight: "1.35",
          }}
        >
          <tbody>
            <tr>
              <td style={{ verticalAlign: "top" }}>
                {data.logoUrl && (
                  <div style={{ marginBottom: "10px" }}>
                    <img
                      src={data.logoUrl}
                      alt="Company Logo"
                      style={{ width: "96px", height: "auto", borderRadius: "6px" }}
                    />
                  </div>
                )}
                <div style={{ marginBottom: "6px" }}>{nameEl}</div>
                <div style={{ marginBottom: "10px" }}>{roleEl}</div>

                <table cellPadding="0" cellSpacing="0">
                  <tbody>{contactRows}</tbody>
                </table>

                {includeQR && qrDataUrl && (
                  <div style={{ marginTop: "10px" }}>
                    <img src={qrDataUrl} alt="QR" style={{ width: "72px", height: "72px", borderRadius: "8px" }} />
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      );
    }

    // Classic + Compact share base table
    const compactMode = layout === "compact";

    return (
      <table
        cellPadding="0"
        cellSpacing="0"
        style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          color: "#111827",
          lineHeight: compactMode ? "1.25" : "1.35",
        }}
      >
        <tbody>
          <tr>
            {leftLogoCell}
            <td style={{ verticalAlign: "top", ...(dividerStyle as any) }}>
              <table cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td style={{ paddingBottom: compactMode ? "2px" : "4px" }}>{nameEl}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: compactMode ? "6px" : "8px" }}>{roleEl}</td>
                  </tr>
                  {contactRows}
                </tbody>
              </table>

              {includeQR && qrDataUrl && (
                <div style={{ marginTop: compactMode ? "8px" : "10px" }}>
                  <img src={qrDataUrl} alt="QR" style={{ width: "64px", height: "64px", borderRadius: "8px" }} />
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }, [
    data,
    fontFamily,
    fontSize,
    icons,
    includeQR,
    layout,
    linkColor,
    linkDecoration,
    qrDataUrl,
    showDivider,
    dividerWidth,
    dividerColor,
  ]);

  return (
    <ToolLayout
      title="Email Signature Generator"
      description="Create professional email signatures for Gmail, Outlook, Apple Mail and more."
    >
      {/* Moat Bar */}
      <div className="mb-6 bg-surface-elevated rounded-xl p-4 border border-border">
        <div className="grid gap-3 md:grid-cols-3 items-start">
          {/* Presets */}
          <div className="min-w-0">
            <Label>Presets</Label>
            <Select
              value={selectedPresetId}
              onValueChange={(val) => {
                setSelectedPresetId(val);
                if (val) applyPreset(val);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Apply a preset" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Built-in</div>
                {BUILT_IN_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-xs text-muted-foreground mt-1">Your presets</div>
                {customPresets.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No saved presets yet</div>
                ) : (
                  customPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <Button variant="outline" onClick={openSavePreset} className="w-full">
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Save preset
              </Button>
              <Button
                variant="outline"
                onClick={requestDeletePreset}
                disabled={!selectedPresetId || !isCustomPresetSelected}
                title="Delete selected custom preset"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Save your signature designs for 1-click reuse.</p>
          </div>

          {/* Quick style */}
          <div className="min-w-0">
            <Label>Quick style</Label>
            <div className="grid gap-2">
              <Select value={layout} onValueChange={(v) => setLayout(v as LayoutPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="stacked">Stacked</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Font</Label>
                  <Select value={font} onValueChange={(v) => setFont(v as FontPreset)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="arial">Arial</SelectItem>
                      <SelectItem value="inter">Inter</SelectItem>
                      <SelectItem value="georgia">Georgia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Size</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[fontSize]}
                      onValueChange={(v) => setFontSize(v[0] ?? 14)}
                      min={12}
                      max={18}
                      step={1}
                    />
                    <div className="text-xs text-muted-foreground w-8 text-right">{fontSize}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Icons</Label>
                    <div className="text-xs text-muted-foreground">Emoji icons</div>
                  </div>
                  <Switch checked={showIcons} onCheckedChange={setShowIcons} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Divider</Label>
                    <div className="text-xs text-muted-foreground">Brand line</div>
                  </div>
                  <Switch checked={showDivider} onCheckedChange={setShowDivider} />
                </div>
              </div>
            </div>
          </div>

          {/* Smart actions */}
          <div className="min-w-0">
            <Label>Smart actions</Label>
            <div className="mt-1 grid gap-1">
              <Button variant="secondary" onClick={SmartFill} className="w-full gap-2">
                <Sparkles className="h-4 w-4" /> Fill missing fields
              </Button>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">QR code</Label>
                  <div className="text-xs text-muted-foreground">Add a scan link</div>
                </div>
                <Switch checked={includeQR} onCheckedChange={setIncludeQR} />
              </div>

              {includeQR && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">QR links to</Label>
                    <Select value={qrValue} onValueChange={(v) => setQrValue(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end justify-end">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <QrCode className="h-4 w-4" />
                      {qrDataUrl ? "Ready" : "—"}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button variant="outline" onClick={handleDownloadHtmlFile} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download HTML
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-tight">
                Pro tip: use <b>Copy Rich Text</b> for Gmail/Outlook signature settings.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Panel */}
        <div className="tool-input-panel space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full Name
              </Label>
              <Input id="fullName" value={data.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle" className="text-sm font-medium">
                Job Title
              </Label>
              <Input id="jobTitle" value={data.jobTitle} onChange={(e) => updateField("jobTitle", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="text-sm font-medium">
              Company
            </Label>
            <Input id="company" value={data.company} onChange={(e) => updateField("company", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone
              </Label>
              <Input id="phone" value={data.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website" className="text-sm font-medium">
                Website
              </Label>
              <Input id="website" value={data.website} onChange={(e) => updateField("website", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="text-sm font-medium">
                LinkedIn (username or URL)
              </Label>
              <Input id="linkedin" value={data.linkedin} onChange={(e) => updateField("linkedin", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brandColor" className="text-sm font-medium">
                Brand Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="brandColor"
                  type="color"
                  value={data.brandColor}
                  onChange={(e) => updateField("brandColor", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={data.brandColor}
                  onChange={(e) => updateField("brandColor", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Company Logo</Label>
              <div className="flex gap-2">
                <Input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="logo-upload" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("logo-upload")?.click()}
                  className="gap-2 flex-1"
                >
                  <Upload className="h-4 w-4" />
                  Upload Logo
                </Button>
                {data.logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => updateField("logoUrl", "")}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Output Panel */}
        <div className="tool-output-panel space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Preview</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyRichText} className="gap-1.5">
                {copiedRich ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Rich Text
              </Button>
              <Button size="sm" onClick={handleCopyHtml} className="gap-1.5">
                {copiedHtml ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy HTML
              </Button>
            </div>
          </div>

          {/* Signature Preview */}
          <div className="p-6 bg-background rounded-lg border border-border">
            <div ref={signatureRef}>{signatureTable}</div>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How to use:</p>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>Click “Copy Rich Text” (best for Gmail/Outlook)</li>
              <li>Open your email client signature settings</li>
              <li>Paste the signature directly</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Save preset */}
      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
            <DialogDescription>
              Save this signature design for one-click reuse (stored locally in your browser).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="presetName">Preset name</Label>
            <Input
              id="presetName"
              value={draftPresetName}
              onChange={(e) => setDraftPresetName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePresetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePreset}>
              <BookmarkPlus className="h-4 w-4 mr-2" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete preset */}
      <AlertDialog open={deletePresetOpen} onOpenChange={setDeletePresetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset?</AlertDialogTitle>
            <AlertDialogDescription>This removes the selected custom preset from this browser.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deletePreset}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ToolLayout>
  );
}
