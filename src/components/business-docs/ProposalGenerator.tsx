import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Download, RotateCcw, Plus, Trash2 } from "lucide-react";
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

type Deliverable = { id: string; item: string; price: string };
type Milestone = { id: string; phase: string; timeline: string };

export function ProposalGenerator() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  
  const [clientCompany, setClientCompany] = useState("");
  const [clientContact, setClientContact] = useState("");
  
  const [projectTitle, setProjectTitle] = useState("");
  const [projectSummary, setProjectSummary] = useState("");
  
  const [deliverables, setDeliverables] = useState<Deliverable[]>([
    { id: "1", item: "", price: "" }
  ]);
  
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: "1", phase: "", timeline: "" }
  ]);
  
  const [totalPrice, setTotalPrice] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const addDeliverable = () => {
    setDeliverables([...deliverables, { id: Date.now().toString(), item: "", price: "" }]);
  };

  const removeDeliverable = (id: string) => {
    if (deliverables.length > 1) {
      setDeliverables(deliverables.filter(d => d.id !== id));
    }
  };

  const updateDeliverable = (id: string, field: keyof Deliverable, value: string) => {
    setDeliverables(deliverables.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addMilestone = () => {
    setMilestones([...milestones, { id: Date.now().toString(), phase: "", timeline: "" }]);
  };

  const removeMilestone = (id: string) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter(m => m.id !== id));
    }
  };

  const updateMilestone = (id: string, field: keyof Milestone, value: string) => {
    setMilestones(milestones.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const resetForm = () => {
    setCompanyName("");
    setContactName("");
    setCompanyAddress("");
    setCompanyEmail("");
    setClientCompany("");
    setClientContact("");
    setProjectTitle("");
    setProjectSummary("");
    setDeliverables([{ id: "1", item: "", price: "" }]);
    setMilestones([{ id: "1", phase: "", timeline: "" }]);
    setTotalPrice("");
    setPaymentTerms("");
    setValidUntil("");
  };

  const proposalText = useMemo(() => {
    const company = companyName || "[YOUR COMPANY]";
    const contact = contactName || "[YOUR NAME]";
    const address = companyAddress || "[YOUR ADDRESS]";
    const email = companyEmail || "[YOUR EMAIL]";
    const client = clientCompany || "[CLIENT COMPANY]";
    const clientContactName = clientContact || "[CLIENT CONTACT]";
    const title = projectTitle || "[PROJECT TITLE]";
    const summary = projectSummary || "[PROJECT SUMMARY]";
    const total = totalPrice || "[TOTAL PRICE]";
    const terms = paymentTerms || "50% upfront, 50% upon completion";
    const valid = validUntil || "[DATE]";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const deliverablesText = deliverables
      .filter(d => d.item)
      .map(d => `• ${d.item}${d.price ? ` - ${d.price}` : ""}`)
      .join("\n") || "• [DELIVERABLE 1]\n• [DELIVERABLE 2]";

    const milestonesText = milestones
      .filter(m => m.phase)
      .map((m, i) => `Phase ${i + 1}: ${m.phase}${m.timeline ? `\n         Timeline: ${m.timeline}` : ""}`)
      .join("\n\n") || "Phase 1: [PHASE NAME]\n         Timeline: [TIMELINE]";

    return `════════════════════════════════════════════════════════════════
                        BUSINESS PROPOSAL
════════════════════════════════════════════════════════════════

${company}
${address}
${email}

Date: ${today}

────────────────────────────────────────────────────────────────

PREPARED FOR:

${client}
Attention: ${clientContactName}

────────────────────────────────────────────────────────────────

PROJECT: ${title}

────────────────────────────────────────────────────────────────

EXECUTIVE SUMMARY

${summary}

────────────────────────────────────────────────────────────────

SCOPE & DELIVERABLES

${deliverablesText}

────────────────────────────────────────────────────────────────

PROJECT TIMELINE

${milestonesText}

────────────────────────────────────────────────────────────────

INVESTMENT

Total Project Cost: ${total}

Payment Terms: ${terms}

────────────────────────────────────────────────────────────────

TERMS & CONDITIONS

1. This proposal is valid until ${valid}
2. Pricing is based on the scope outlined above
3. Any changes to scope may affect timeline and pricing
4. All intellectual property transfers upon final payment
5. Either party may terminate with 14 days written notice

────────────────────────────────────────────────────────────────

ACCEPTANCE

To accept this proposal, please sign below and return a copy.


Client Signature: _________________________

Print Name: _________________________

Date: _________________________

────────────────────────────────────────────────────────────────

Thank you for considering ${company} for this project.
We look forward to the opportunity to work with you.

Best regards,
${contact}
${company}
${email}

════════════════════════════════════════════════════════════════`;
  }, [
    companyName, contactName, companyAddress, companyEmail,
    clientCompany, clientContact, projectTitle, projectSummary,
    deliverables, milestones, totalPrice, paymentTerms, validUntil
  ]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <h3 className="font-semibold text-foreground">Your Company</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Company Name</Label>
              <Input 
                placeholder="Your Company Name" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)} 
              />
            </div>
            <div>
              <Label>Your Name</Label>
              <Input 
                placeholder="Your Name" 
                value={contactName} 
                onChange={(e) => setContactName(e.target.value)} 
              />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Textarea 
              placeholder="Company Address" 
              value={companyAddress} 
              onChange={(e) => setCompanyAddress(e.target.value)} 
              rows={2}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input 
              type="email"
              placeholder="contact@company.com" 
              value={companyEmail} 
              onChange={(e) => setCompanyEmail(e.target.value)} 
            />
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <h3 className="font-semibold text-foreground">Client Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Client Company</Label>
              <Input 
                placeholder="Client Company Name" 
                value={clientCompany} 
                onChange={(e) => setClientCompany(e.target.value)} 
              />
            </div>
            <div>
              <Label>Client Contact</Label>
              <Input 
                placeholder="Client Contact Name" 
                value={clientContact} 
                onChange={(e) => setClientContact(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <h3 className="font-semibold text-foreground">Project Details</h3>
          <div>
            <Label>Project Title</Label>
            <Input 
              placeholder="Project Name" 
              value={projectTitle} 
              onChange={(e) => setProjectTitle(e.target.value)} 
            />
          </div>
          <div>
            <Label>Executive Summary</Label>
            <Textarea 
              placeholder="Brief overview of the project and its benefits..." 
              value={projectSummary} 
              onChange={(e) => setProjectSummary(e.target.value)} 
              rows={4}
            />
          </div>
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Deliverables</h3>
            <Button variant="outline" size="sm" onClick={addDeliverable}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {deliverables.map((d) => (
            <div key={d.id} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input 
                  placeholder="Deliverable item" 
                  value={d.item} 
                  onChange={(e) => updateDeliverable(d.id, "item", e.target.value)} 
                />
              </div>
              <div className="w-28">
                <Input 
                  placeholder="Price" 
                  value={d.price} 
                  onChange={(e) => updateDeliverable(d.id, "price", e.target.value)} 
                />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => removeDeliverable(d.id)}
                disabled={deliverables.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Timeline / Milestones</h3>
            <Button variant="outline" size="sm" onClick={addMilestone}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {milestones.map((m) => (
            <div key={m.id} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input 
                  placeholder="Phase name" 
                  value={m.phase} 
                  onChange={(e) => updateMilestone(m.id, "phase", e.target.value)} 
                />
              </div>
              <div className="w-32">
                <Input 
                  placeholder="Timeline" 
                  value={m.timeline} 
                  onChange={(e) => updateMilestone(m.id, "timeline", e.target.value)} 
                />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => removeMilestone(m.id)}
                disabled={milestones.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="bg-surface-elevated rounded-xl p-5 sm:p-6 border border-border space-y-4">
          <h3 className="font-semibold text-foreground">Pricing & Terms</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Total Price</Label>
              <Input 
                placeholder="e.g., $10,000" 
                value={totalPrice} 
                onChange={(e) => setTotalPrice(e.target.value)} 
              />
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input 
                type="date" 
                value={validUntil} 
                onChange={(e) => setValidUntil(e.target.value)} 
              />
            </div>
          </div>
          <div>
            <Label>Payment Terms</Label>
            <Input 
              placeholder="e.g., 50% upfront, 50% upon completion" 
              value={paymentTerms} 
              onChange={(e) => setPaymentTerms(e.target.value)} 
            />
          </div>
        </div>

        <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto">
          <RotateCcw className="w-4 h-4 mr-2" /> Reset
        </Button>
      </div>

      <div className="bg-white dark:bg-background rounded-xl border border-border p-6 shadow-sm">
        <div className="max-h-[600px] overflow-y-auto">
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">{proposalText}</pre>
        </div>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => copyToClipboard(proposalText)}>
            <Copy className="w-4 h-4 mr-2" /> Copy
          </Button>
          <Button onClick={() => downloadText("proposal.txt", proposalText)}>
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>
      </div>
    </div>
  );
}
