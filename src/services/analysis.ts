import type { DemoCase, EvidenceStatus } from '../types';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const supportedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ImageValidation = { ok: true } | { ok: false; reason: 'type' | 'size' };

export function validateImageFile(file: Pick<File, 'name' | 'size' | 'type'>): ImageValidation {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!supportedExtensions.has(extension)) return { ok: false, reason: 'type' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: 'size' };
  if (file.type && !supportedMimeTypes.has(file.type.toLowerCase())) return { ok: false, reason: 'type' };
  return { ok: true };
}

export interface RedactionMask {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function flattenRedactions(file: File, masks: RedactionMask[]): Promise<Blob> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.drawImage(image, 0, 0);
  context.fillStyle = '#0b1020';
  for (const mask of masks) {
    const x = Math.max(0, Math.min(image.width, mask.x * image.width));
    const y = Math.max(0, Math.min(image.height, mask.y * image.height));
    const width = Math.max(0, Math.min(image.width - x, mask.width * image.width));
    const height = Math.max(0, Math.min(image.height - y, mask.height * image.height));
    context.fillRect(x, y, width, height);
  }
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create redacted image');
  return blob;
}

export interface EvidenceCoverage {
  score: number;
  confirmed: number;
  total: number;
  rubric: string;
}

export function getEvidenceCoverage(findings: { status: EvidenceStatus }[]): EvidenceCoverage {
  const confirmed = findings.filter((finding) => finding.status === 'confirmed').length;
  const total = findings.length;
  return {
    score: total === 0 ? 0 : Math.round((confirmed / total) * 100),
    confirmed,
    total,
    rubric: 'Directly supported findings ÷ all listed findings × 100. This describes evidence coverage within the sample only; it is not a statistical probability of correctness.',
  };
}

export function buildWhatsAppMessage(demo: DemoCase, completedStepIds: Set<string>, locale: 'en' | 'hi'): string {
  const isEnglish = locale === 'en';
  const confirmed = demo.findings.filter((finding) => finding.status === 'confirmed');
  const unknown = demo.findings.filter((finding) => finding.status === 'unknown');
  const actions = demo.steps.map((step) => `${completedStepIds.has(step.id) ? '[x]' : '[ ]'} ${step.title[locale]}`);
  const sourceLines = demo.sources.map((source) => `${source.title[locale]} — ${source.id} (fictional demo source)`);
  return [
    `FormRescue AI — ${isEnglish ? 'sample recovery plan' : 'नमूना समाधान योजना'}`,
    '',
    `${isEnglish ? 'Problem' : 'समस्या'}: ${demo.summary[locale]}`,
    '',
    `${isEnglish ? 'Confirmed in this fictional sample' : 'इस काल्पनिक नमूने में पुष्ट'}:`,
    ...confirmed.map((finding) => `• ${finding.text[locale]}`),
    '',
    `${isEnglish ? 'Still unknown' : 'अभी अज्ञात'}:`,
    ...unknown.map((finding) => `• ${finding.text[locale]}`),
    '',
    `${isEnglish ? 'Next steps' : 'अगले कदम'}:`,
    ...actions,
    '',
    `${isEnglish ? 'Sources' : 'स्रोत'}:`,
    ...sourceLines,
    '',
    isEnglish ? 'Demo rules are fictional. Check the real authority before relying on a requirement.' : 'डेमो नियम काल्पनिक हैं। किसी नियम पर भरोसा करने से पहले असली प्राधिकरण से जाँचें।',
  ].join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based legacy browser API.
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }
  textarea.remove();
  return succeeded;
}

export function buildSpeechText(demo: DemoCase, completedStepIds: Set<string>, locale: 'en' | 'hi', plainLanguage: boolean): string {
  const summary = plainLanguage ? demo.plainSummary[locale] : demo.summary[locale];
  const findings = demo.findings.map((finding) => `${finding.status}: ${finding.text[locale]}`).join('. ');
  const steps = demo.steps.map((step, index) => `${index + 1}. ${step.title[locale]}. ${step.description[locale]}`).join('. ');
  const progress = completedStepIds.size ? `${completedStepIds.size} ${locale === 'en' ? 'steps completed' : 'कदम पूरे हुए'}.` : '';
  return `${summary}. ${findings}. ${steps}. ${progress}`;
}
