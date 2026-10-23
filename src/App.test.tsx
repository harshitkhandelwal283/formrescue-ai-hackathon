import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { demoCases } from './data/cases';

function openFirstSample() {
  render(<App />);
  fireEvent.click(screen.getAllByRole('button', { name: /try a sample case/i })[0]);
}

describe('FormRescue user workflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a complete fictional report from the primary sample action', async () => {
    openFirstSample();
    expect(await screen.findByRole('heading', { name: 'A clear plan for this sample' })).toBeInTheDocument();
    expect(screen.getAllByText('Document upload failed: file size exceeds limit.').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('DEMO SOURCE — FICTIONAL RULE FOR THIS EXAMPLE')).toBeInTheDocument();
    expect(screen.getByText('The fictional example sets a maximum upload size of 2 MB.')).toBeInTheDocument();
    expect(screen.getByText('A high-resolution scan or image-heavy PDF may have made the file larger.')).toBeInTheDocument();
    expect(screen.getAllByText('Whether a real portal accepts this file format is unknown.').length).toBeGreaterThanOrEqual(2);
  });

  it('switches report scenarios and preserves their evidence distinction', async () => {
    openFirstSample();
    fireEvent.click(screen.getByRole('button', { name: /name mismatch/i }));
    expect((await screen.findAllByText('Applicant name does not match the uploaded certificate.')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('The sample application and certificate display different name strings.')).toBeInTheDocument();
    expect(screen.getAllByText('The exact matching rules used by a real admissions authority are unknown.').length).toBeGreaterThanOrEqual(2);
  });

  it.each(demoCases)('opens the complete report for $id', async (demo) => {
    openFirstSample();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(demo.shortName.en, 'i') }));
    expect((await screen.findAllByText(demo.error.en)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(demo.sources[0].id)).toBeInTheDocument();
    expect(screen.getByText('DEMO SOURCE — FICTIONAL RULE FOR THIS EXAMPLE')).toBeInTheDocument();
  });

  it('switches all visible sample content to Hindi and supports simpler wording', async () => {
    openFirstSample();
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'hi' } });
    expect(await screen.findByRole('heading', { name: 'इस नमूने के लिए साफ़ योजना' })).toBeInTheDocument();
    expect(screen.getByText('डेमो स्रोत — इस उदाहरण के लिए काल्पनिक नियम')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'सरल भाषा में समझाएँ' }));
    expect(screen.getAllByText(/नमूना फ़ाइल इस काल्पनिक पोर्टल की सीमा से बड़ी है/).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps checklist progress in memory and can reset it', async () => {
    openFirstSample();
    const step = screen.getByRole('button', { name: 'Mark complete: Check the current file size' });
    fireEvent.click(step);
    expect(step).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1/5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start a new analysis' }));
    expect(screen.queryByRole('heading', { name: 'A clear plan for this sample' })).not.toBeInTheDocument();
  });

  it('keeps optional context local and clears it on reset', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Category (optional)'), { target: { value: demoCases[0].id } });
    fireEvent.change(screen.getByLabelText('Jurisdiction (optional)'), { target: { value: 'Madhya Pradesh' } });
    fireEvent.change(screen.getByLabelText('What happened? (optional)'), { target: { value: 'The upload stopped at the file step.' } });
    expect(screen.getByText('In demo mode, these optional notes stay on this page and do not change a prewritten sample report.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /try a sample case/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Start a new analysis' }));
    expect(screen.getByLabelText('Category (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Jurisdiction (optional)')).toHaveValue('');
    expect(screen.getByLabelText('What happened? (optional)')).toHaveValue('');
  });

  it('never invents a live provider connection and can return to demo mode', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Live AI mode' }));
    expect(await screen.findByRole('heading', { name: 'Live analysis is not configured' })).toBeInTheDocument();
    expect(screen.getByText(/No API key is requested and no live request will be sent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue in demo mode' }));
    expect(await screen.findByRole('heading', { name: 'Choose a sample case' })).toBeInTheDocument();
  });

  it('validates unsupported and oversized screenshots in the browser', () => {
    render(<App />);
    const input = screen.getByLabelText('Browse files') as HTMLInputElement;
    const unsupported = new File(['x'], 'document.gif', { type: 'image/gif' });
    fireEvent.change(input, { target: { files: [unsupported] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPG, PNG or WebP image.');
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'document.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByRole('alert')).toHaveTextContent('This image is over the 10 MB limit. Choose a smaller image.');
  });

  it('keeps a selected image local, discloses that it is not analyzed, and reports a decode failure', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:local-screenshot') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    render(<App />);
    const image = new File([new Uint8Array([1, 2, 3])], 'screen.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Browse files'), { target: { files: [image] } });
    const preview = await screen.findByAltText('Local screenshot preview. No text has been identified.');
    expect(preview).toHaveAttribute('src', 'blob:local-screenshot');
    expect(screen.getByText('Demo mode does not analyze your uploaded image. It stays here as a preview until you remove it.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add centered cover' }));
    const cover = screen.getByRole('group', { name: /Redaction cover 1/ });
    expect(cover).toHaveAttribute('tabindex', '0');
    expect(cover).toHaveAttribute('aria-describedby', 'redaction-keyboard-help');
    expect(cover).toHaveAttribute('aria-keyshortcuts');
    expect(cover).toHaveStyle({ left: '35%', top: '35%', width: '30%', height: '15%' });
    fireEvent.keyDown(cover, { key: 'ArrowRight' });
    expect(cover).toHaveStyle({ left: '37.5%' });
    fireEvent.keyDown(cover, { key: 'ArrowDown', shiftKey: true });
    expect(cover).toHaveStyle({ height: '17.5%' });
    fireEvent.keyDown(cover, { key: 'Delete' });
    expect(screen.queryByRole('group', { name: /Redaction cover 1/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add centered cover' }));
    fireEvent.keyDown(screen.getByRole('group', { name: /Redaction cover 1/ }), { key: 'Backspace' });
    expect(screen.queryByRole('group', { name: /Redaction cover 1/ })).not.toBeInTheDocument();
    fireEvent.error(preview);
    expect(screen.getByRole('alert')).toHaveTextContent('This image could not be previewed. Try another file.');
  });

  it('uses browser copy and print actions with truthful success feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const print = vi.fn();
    Object.defineProperty(window, 'print', { configurable: true, value: print });
    openFirstSample();
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy as WhatsApp message' })[0]);
    await waitFor(() => expect(screen.getByText('Recovery message copied.')).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledOnce();
    fireEvent.click(screen.getAllByRole('button', { name: 'Download / Print checklist' })[0]);
    expect(print).toHaveBeenCalledOnce();
    const printReport = document.querySelector('.print-report');
    expect(printReport).toHaveTextContent('FormRescue AI — BrightPath Scholarship Portal');
    expect(printReport).toHaveTextContent('The demo portal shows that the upload exceeded its limit.');
    expect(printReport).toHaveTextContent('CONFIRMED');
    expect(printReport).toHaveTextContent('Check the current file size');
    expect(printReport).toHaveTextContent('DEMO-A-RULE-01');
    expect(printReport).toHaveTextContent('Check with the relevant official authority');
    for (const limit of [
      'Submit an application on your behalf.',
      'Guarantee acceptance or reverse an official rejection.',
      'Replace the responsible authority or its helpline.',
      'Guarantee every interpretation is correct.',
      'Call an official rule verified without a real supporting source.',
      'Turn a fictional demo source into a real authority.',
      'Determine information the evidence does not establish.',
      'Ask you for a password or one-time code.',
    ]) expect(printReport).toHaveTextContent(limit);
  });
});
