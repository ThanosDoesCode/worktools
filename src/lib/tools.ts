export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'finance' | 'operations' | 'hr';
  slug: string;
  keywords: string[];
  icon: string;
}

export const tools: Tool[] = [
  {
    id: '1',
    name: 'Email Signature Generator',
    description: 'Create professional email signatures for Gmail, Outlook, and more',
    category: 'communication',
    slug: 'email-signature-generator',
    keywords: ['email', 'signature', 'gmail', 'outlook', 'professional'],
    icon: 'Mail',
  },
  {
    id: '2',
    name: 'Invoice Generator',
    description: 'Create and download professional invoices instantly',
    category: 'finance',
    slug: 'invoice-generator',
    keywords: ['invoice', 'billing', 'pdf', 'business'],
    icon: 'FileText',
  },
  {
    id: '3',
    name: 'Margin vs Markup Calculator',
    description: 'Calculate profit margins and markup percentages instantly',
    category: 'finance',
    slug: 'margin-vs-markup-calculator',
    keywords: ['margin', 'markup', 'profit', 'pricing', 'calculator'],
    icon: 'Percent',
  },
  {
    id: '4',
    name: 'Break-Even Calculator',
    description: 'Find your break-even point in units and revenue',
    category: 'finance',
    slug: 'break-even-calculator',
    keywords: ['break-even', 'breakeven', 'profit', 'costs'],
    icon: 'TrendingUp',
  },
  {
    id: '5',
    name: 'ROI Calculator',
    description: 'Calculate return on investment and payback period',
    category: 'finance',
    slug: 'roi-calculator',
    keywords: ['roi', 'return', 'investment', 'profit'],
    icon: 'PiggyBank',
  },
  {
    id: '6',
    name: 'Pricing Calculator',
    description: 'Calculate optimal selling prices from costs and margins',
    category: 'finance',
    slug: 'pricing-calculator',
    keywords: ['pricing', 'price', 'margin', 'selling'],
    icon: 'Tag',
  },
  {
    id: '7',
    name: 'VAT Calculator',
    description: 'Add or remove VAT from any amount with EU rates',
    category: 'finance',
    slug: 'vat-calculator',
    keywords: ['vat', 'tax', 'eu', 'europe', 'gst'],
    icon: 'Calculator',
  },
  {
    id: '8',
    name: 'Cash Flow Forecast',
    description: 'Project your business cash flow and runway',
    category: 'finance',
    slug: 'cash-flow-forecast',
    keywords: ['cash', 'flow', 'forecast', 'runway', 'projection'],
    icon: 'LineChart',
  },
  {
    id: '9',
    name: 'Headcount Cost Calculator',
    description: 'Calculate true employee costs including taxes and benefits',
    category: 'hr',
    slug: 'headcount-cost-calculator',
    keywords: ['headcount', 'employee', 'salary', 'cost', 'hiring'],
    icon: 'Users',
  },
  {
    id: '10',
    name: 'Meeting Cost Calculator',
    description: 'Calculate how much your meetings really cost',
    category: 'hr',
    slug: 'meeting-cost-calculator',
    keywords: ['meeting', 'cost', 'time', 'productivity'],
    icon: 'Clock',
  },
];

export const categories = [
  { id: 'communication', name: 'Communication', description: 'Email, messaging, and professional communication tools' },
  { id: 'finance', name: 'Finance & Pricing', description: 'Calculators for margins, pricing, VAT, and cash flow' },
  { id: 'operations', name: 'Operations', description: 'Tools for day-to-day business operations' },
  { id: 'hr', name: 'HR & Costs', description: 'Employee costs, meetings, and workforce tools' },
];

export function searchTools(query: string): Tool[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return tools;
  
  return tools.filter(tool => 
    tool.name.toLowerCase().includes(lowerQuery) ||
    tool.description.toLowerCase().includes(lowerQuery) ||
    tool.keywords.some(k => k.includes(lowerQuery)) ||
    tool.category.includes(lowerQuery)
  );
}

export function getToolsByCategory(category: string): Tool[] {
  return tools.filter(tool => tool.category === category);
}

export function getToolBySlug(slug: string): Tool | undefined {
  return tools.find(tool => tool.slug === slug);
}
