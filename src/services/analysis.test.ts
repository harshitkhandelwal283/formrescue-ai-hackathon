import { describe, expect, it, vi } from 'vitest';
import { demoCases } from '../data/cases';
import { evaluationCases } from '../data/evaluations';
import { buildWhatsAppMessage, flattenRedactions, getEvidenceCoverage, validateImageFile } from './analysis';
import { liveAnalysisAdapter } from './liveAdapter';

describe('FormRescue demo data', () => {
  it('contains all four named fictional scenarios with English and Hindi content', () => {
    expect(demoCases.map((item) => item.id)).toEqual([
      'brightpath-upload', 'northstar-name', 'civicapply-expiry', 'cleargrid-address',
    ]);
    for (const demo of demoCases) {
      expect(demo.findings.some((finding) => finding.status === 'confirmed')).toBe(true);
      expect(demo.findings.some((finding) => finding.status === 'likely')).toBe(true);
      expect(demo.findings.some((finding) => finding.status === 'unknown')).toBe(true);
      expect(demo.steps.length).toBeGreaterThanOrEqual(5);
      expect(demo.sources[0].id).toMatch(/^DEMO-[A-D]-RULE-01$/);
      expect(demo.error.en).toBeTruthy();
      expect(demo.error.hi).toBeTruthy();
    }
  });

  it('includes ten varied fictional evaluation scenarios', () => {
    expect(evaluationCases).toHaveLength(10);
    expect(evaluationCases.some((item) => item.scenario.toLowerCase().includes('conflict'))).toBe(true);
    expect(evaluationCases.some((item) => item.expected.toLowerCase().includes('cannot be determined'))).toBe(true);
    expect(evaluationCases.some((item) => item.scenario.toLowerCase().includes('blurry'))).toBe(true);
  });
});

describe('evidence and input utilities', () => {
  it('fails closed through the typed live adapter without sending a request', async () => {
    expect(liveAnalysisAdapter.status).toBe('not-configured');
    expect(liveAnalysisAdapter.missingCapabilities.hi.length).toBeGreaterThan(0);
    await expect(liveAnalysisAdapter.analyze({ language: 'en', consented: true })).rejects.toThrow('no request was sent');
  });

  it('calculates evidence coverage from direct findings rather than confidence claims', () => {
    expect(getEvidenceCoverage([{ status: 'confirmed' }, { status: 'likely' }, { status: 'unknown' }])).toMatchObject({
      score: 33, confirmed: 1, total: 3,
    });
    expect(getEvidenceCoverage([]).score).toBe(0);
  });

  it('validates supported image types and the 10 MB boundary', () => {
    expect(validateImageFile({ name: 'proof.PNG', size: 100, type: 'image/png' })).toEqual({ ok: true });
    expect(validateImageFile({ name: 'proof.gif', size: 100, type: 'image/gif' })).toEqual({ ok: false, reason: 'type' });
    expect(validateImageFile({ name: 'proof.jpg', size: 10 * 1024 * 1024 + 1, type: 'image/jpeg' })).toEqual({ ok: false, reason: 'size' });
    expect(validateImageFile({ name: 'proof.jpg', size: 100, type: 'image/gif' })).toEqual({ ok: false, reason: 'type' });
  });

  it('burns redaction masks into a separate PNG blob and closes the decoded image', async () => {
    const decoded = { width: 100, height: 50, close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(decoded));
    const context = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const output = new Blob(['flattened'], { type: 'image/png' });
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(output));
    try {
      const result = await flattenRedactions(new File(['input'], 'screen.png', { type: 'image/png' }), [{ x: .1, y: .2, width: .3, height: .4 }]);
      expect(result.type).toBe('image/png');
      expect(context.fillStyle).toBe('#0b1020');
      expect(context.fillRect).toHaveBeenCalledWith(10, 10, 30, 20);
      expect(decoded.close).toHaveBeenCalledOnce();
    } finally {
      getContext.mockRestore();
      toBlob.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('creates a compact WhatsApp message without private file data', () => {
    const message = buildWhatsAppMessage(demoCases[0], new Set(), 'en');
    expect(message).toContain('file size');
    expect(message).toMatch(/still unknown/i);
    expect(message).toContain('DEMO-A-RULE-01');
    expect(message).not.toMatch(/password|one-time code|card number/i);
    expect(message).not.toContain('https://');
  });
});
