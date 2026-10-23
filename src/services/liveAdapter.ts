import type { Locale } from '../types';

export interface LiveAnalysisRequest {
  image?: File;
  redactedImage?: Blob;
  errorText?: string;
  category?: string;
  jurisdiction?: string;
  context?: string;
  language: Locale;
  consented: boolean;
}

export interface LiveFinding {
  status: 'confirmed' | 'likely' | 'unknown';
  statement: string;
  reason: string;
  sourceId?: string;
}

export interface LiveRecoveryStep {
  title: string;
  explanation: string;
  why: string;
  duration?: string;
  prerequisite?: string;
  successVerification: string;
  sourceId?: string;
}

export interface LiveAnalysisReport {
  extractedText: string[];
  screenshotObservations: string[];
  issueSummary: string;
  category: string;
  findings: LiveFinding[];
  recommendedSteps: LiveRecoveryStep[];
  missingDocuments: string[];
  clarificationQuestions: string[];
  verificationSteps: string[];
  ifRetryFails: string[];
  sources: Array<{ title: string; publisher: string; url: string; excerpt: string; retrievedAt: string }>;
  limitations: string[];
  language: Locale;
  analysisMode: 'live';
}

export interface LiveAnalysisAdapter {
  providerName: string;
  status: 'not-configured' | 'ready';
  missingCapabilities: Record<Locale, string[]>;
  analyze(request: LiveAnalysisRequest): Promise<LiveAnalysisReport>;
}

/**
 * This typed boundary is intentionally nonfunctional until a documented provider, secure
 * runtime, consent flow, result validation and official-source retriever are configured.
 * It never falls through to sample data and never sends a request.
 */
export const liveAnalysisAdapter: LiveAnalysisAdapter = {
  providerName: 'No provider selected',
  status: 'not-configured',
  missingCapabilities: {
    en: ['Documented vision provider and model', 'Secure request/credential adapter', 'Official-source retrieval', 'Runtime structured-result validation'],
    hi: ['दस्तावेज़ित विज़न प्रदाता और मॉडल', 'सुरक्षित अनुरोध/क्रेडेंशियल एडाप्टर', 'आधिकारिक स्रोतों की खोज', 'संरचित परिणामों की रनटाइम जाँच'],
  },
  async analyze(_request) {
    throw new Error('Live AI is not configured; no request was sent.');
  },
};
