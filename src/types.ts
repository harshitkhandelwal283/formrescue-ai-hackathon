export type Locale = 'en' | 'hi';
export type EvidenceStatus = 'confirmed' | 'likely' | 'unknown';

export interface Finding {
  id: string;
  status: EvidenceStatus;
  text: Record<Locale, string>;
  why: Record<Locale, string>;
  whatWouldHelp?: Record<Locale, string>;
}

export interface RecoveryStep {
  id: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  why: Record<Locale, string>;
  verify: Record<Locale, string>;
  duration?: Record<Locale, string>;
  prerequisite?: Record<Locale, string>;
  sourceId?: string;
}

export interface DemoSource {
  id: string;
  title: Record<Locale, string>;
  publisher: Record<Locale, string>;
  excerpt: Record<Locale, string>;
}

export interface PortalField {
  label: Record<Locale, string>;
  value: Record<Locale, string>;
}

export interface DemoCase {
  id: string;
  shortName: Record<Locale, string>;
  institution: Record<Locale, string>;
  category: Record<Locale, string>;
  error: Record<Locale, string>;
  portalStatus: Record<Locale, string>;
  portalFields: PortalField[];
  portalNote: Record<Locale, string>;
  summary: Record<Locale, string>;
  plainSummary: Record<Locale, string>;
  findings: Finding[];
  steps: RecoveryStep[];
  missingDocuments: Record<Locale, string[]>;
  questions: Record<Locale, string[]>;
  verification: Record<Locale, string[]>;
  ifFails: Record<Locale, string[]>;
  sources: DemoSource[];
}

export interface EvaluationCase {
  id: string;
  scenario: string;
  expected: string;
  labels: EvidenceStatus[];
}
