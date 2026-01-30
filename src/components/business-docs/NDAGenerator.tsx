import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function NDAGenerator() {
  const [disclosingParty, setDisclosingParty] = useState("");
  const [receivingParty, setReceivingParty] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [duration, setDuration] = useState("2");
  const [jurisdiction, setJurisdiction] = useState("");
  const [ndaType, setNdaType] = useState<"mutual" | "one-way">("one-way");

  const resetForm = () => {
    setDisclosingParty("");
    setReceivingParty("");
    setEffectiveDate("");
    setPurpose("");
    setDuration("2");
    setJurisdiction("");
    setNdaType("one-way");
  };

  const ndaText = useMemo(() => {
    const date = effectiveDate || "[DATE]";
    const disclosing = disclosingParty || "[DISCLOSING PARTY]";
    const receiving = receivingParty || "[RECEIVING PARTY]";
    const purposeText = purpose || "[PURPOSE OF DISCLOSURE]";
    const jurisdictionText = jurisdiction || "[JURISDICTION]";
    const isMutual = ndaType === "mutual";

    const title = isMutual ? "MUTUAL NON-DISCLOSURE AGREEMENT" : "NON-DISCLOSURE AGREEMENT";
    const partiesIntro = isMutual
      ? `PARTY A: ${disclosing}\nPARTY B: ${receiving}\n\n(Each a "Party" and collectively the "Parties")`
      : `DISCLOSING PARTY: ${disclosing}\nRECEIVING PARTY: ${receiving}`;

    const obligationsText = isMutual
      ? `Each Party agrees to:
a) Hold the other Party's Confidential Information in strict confidence
b) Not disclose any Confidential Information to third parties without prior written consent
c) Use the Confidential Information solely for the Purpose stated above
d) Protect the Confidential Information with the same degree of care used to protect its own confidential information`
      : `The Receiving Party agrees to:
a) Hold the Confidential Information in strict confidence
b) Not disclose any Confidential Information to third parties without prior written consent
c) Use the Confidential Information solely for the Purpose stated above
d) Protect the Confidential Information with the same degree of care used to protect its own confidential information`;

    const returnText = isMutual
      ? `Upon termination of this Agreement or upon request, each Party shall promptly return or destroy all Confidential Information received from the other Party and any copies thereof.`
      : `Upon termination of this Agreement or upon request, the Receiving Party shall promptly return or destroy all Confidential Information and any copies thereof.`;

    const signatureBlock = isMutual
      ? `PARTY A:                             PARTY B:

_________________________           _________________________
${disclosing}                       ${receiving}

Date: ___________________           Date: ___________________`
      : `DISCLOSING PARTY:                    RECEIVING PARTY:

_________________________           _________________________
${disclosing}                       ${receiving}

Date: ___________________           Date: ___________________`;

    return `${title}

This ${isMutual ? "Mutual " : ""}Non-Disclosure Agreement ("Agreement") is entered into as of ${date} ("Effective Date") by and between:

${partiesIntro}

1. PURPOSE
${isMutual ? "The Parties wish" : "The Disclosing Party wishes"} to disclose certain confidential information for the purpose of: ${purposeText}

2. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any and all non-public information, whether written, oral, electronic, or visual, disclosed by ${isMutual ? "either Party to the other" : "the Disclosing Party to the Receiving Party"}, including but not limited to: trade secrets, business plans, financial information, customer lists, technical data, and proprietary information.

3. OBLIGATIONS
${obligationsText}

4. EXCLUSIONS
This Agreement does not apply to information that:
a) Is or becomes publicly available through no fault of the ${isMutual ? "receiving Party" : "Receiving Party"}
b) Was already known to the ${isMutual ? "receiving Party" : "Receiving Party"} prior to disclosure
c) Is independently developed without use of Confidential Information
d) Is disclosed with the prior written approval of the ${isMutual ? "disclosing Party" : "Disclosing Party"}

5. TERM
This Agreement shall remain in effect for ${duration === "indefinite" ? "an indefinite period" : `${duration} years`} from the Effective Date.

6. RETURN OF INFORMATION
${returnText}

7. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of ${jurisdictionText}.

8. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the ${isMutual ? "Parties" : "parties"} concerning the subject matter hereof.

IN WITNESS WHEREOF, the ${isMutual ? "Parties have" : "parties have"} executed this Agreement as of the Effective Date.


${signatureBlock}`;
  }, [disclosingParty, receivingParty, effectiveDate, purpose, duration, jurisdiction, ndaType]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border">
          <h3 className="font-semibold text-foreground mb-4">NDA Type</h3>
          <Select value={ndaType} onValueChange={(v: "mutual" | "one-way") => setNdaType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-way">One-Way (Standard)</SelectItem>
              <SelectItem value="mutual">Mutual (Two-Way)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">
            {ndaType === "mutual" 
              ? "Both parties share confidential information and are bound by the same obligations."
              : "One party discloses confidential information, the other agrees to protect it."}
          </p>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <h3 className="font-semibold text-foreground mb-2">Parties</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{ndaType === "mutual" ? "Party A" : "Disclosing Party"}</Label>
              <Input 
                placeholder="Company or Person Name" 
                value={disclosingParty} 
                onChange={(e) => setDisclosingParty(e.target.value)} 
              />
            </div>
            <div>
              <Label>{ndaType === "mutual" ? "Party B" : "Receiving Party"}</Label>
              <Input 
                placeholder="Company or Person Name" 
                value={receivingParty} 
                onChange={(e) => setReceivingParty(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <h3 className="font-semibold text-foreground mb-2">Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Effective Date</Label>
              <Input 
                type="date" 
                value={effectiveDate} 
                onChange={(e) => setEffectiveDate(e.target.value)} 
              />
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years</SelectItem>
                  <SelectItem value="3">3 Years</SelectItem>
                  <SelectItem value="5">5 Years</SelectItem>
                  <SelectItem value="indefinite">Indefinite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Jurisdiction / Governing Law</Label>
            <Input 
              placeholder="e.g., State of California, United States" 
              value={jurisdiction} 
              onChange={(e) => setJurisdiction(e.target.value)} 
            />
          </div>
          <div>
            <Label>Purpose of Disclosure</Label>
            <Textarea 
              placeholder="Describe the purpose for sharing confidential information..." 
              value={purpose} 
              onChange={(e) => setPurpose(e.target.value)} 
              rows={3}
            />
          </div>
        </div>

        <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto">
          <RotateCcw className="w-4 h-4 mr-2" /> Reset
        </Button>
      </div>

      <div className="bg-white dark:bg-background rounded-xl border border-border p-6 shadow-sm max-h-[700px] overflow-y-auto">
        <div>
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">{ndaText}</pre>
        </div>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => copyToClipboard(ndaText)}>
            <Copy className="w-4 h-4 mr-2" /> Copy
          </Button>
          <Button onClick={() => downloadText("nda.txt", ndaText)}>
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>
      </div>
    </div>
  );
}
