import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleAlert,
  FileCheck2, FileImage, FileText, HelpCircle, Info, Languages, LockKeyhole,
  MessageCircle, RotateCcw, ShieldCheck, Sparkles, Volume2, VolumeX, X,
} from 'lucide-react';
import { demoCases } from './data/cases';
import { uiText } from './i18n/strings';
import type { DemoCase, EvidenceStatus, Locale, RecoveryStep } from './types';
import {
  buildSpeechText, buildWhatsAppMessage, copyText, flattenRedactions,
  getEvidenceCoverage, validateImageFile,
} from './services/analysis';
import { liveAnalysisAdapter } from './services/liveAdapter';
import type { RedactionMask } from './services/analysis';

const statusIcon = {
  confirmed: CheckCircle2,
  likely: CircleAlert,
  unknown: HelpCircle,
} satisfies Record<EvidenceStatus, typeof CheckCircle2>;

function EvidenceBadge({ status, label }: { status: EvidenceStatus; label: string }) {
  const Icon = statusIcon[status];
  return <span className={`evidence-badge evidence-${status}`}><Icon size={15} aria-hidden="true" />{label}</span>;
}

function SectionHeading({ eyebrow, title, description, light = false }: { eyebrow: string; title: string; description?: string; light?: boolean }) {
  return <div className={`section-heading${light ? ' section-heading-light' : ''}`}><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function PortalPreview({ demo, locale }: { demo: DemoCase; locale: Locale }) {
  const isEn = locale === 'en';
  return (
    <div className="portal-window" aria-label={`${demo.institution[locale]} fictional demonstration portal`}>
      <div className="portal-topbar"><div className="portal-brand"><span className="portal-mark"><FileCheck2 size={15} /></span><span>{demo.institution[locale]}</span></div><span className="demo-ribbon">{isEn ? 'DEMO DATA' : 'डेमो डेटा'}</span></div>
      <div className="portal-body">
        <div className="portal-caption">{demo.category[locale]} <span>·</span> {isEn ? 'Application' : 'आवेदन'}</div>
        <div className="portal-status"><CircleAlert size={15} />{demo.portalStatus[locale]}</div>
        <div className="portal-error"><CircleAlert size={18} /><span>{demo.error[locale]}</span><i className="scan-line" aria-hidden="true" /></div>
        <div className="portal-fields">{demo.portalFields.map((field) => <div className="portal-field" key={field.label.en}><span>{field.label[locale]}</span><strong>{field.value[locale]}</strong></div>)}</div>
        <div className="portal-note"><Info size={13} />{demo.portalNote[locale]}</div>
      </div>
      <div className="portal-footer"><span className="fake-lock"><LockKeyhole size={12} />{isEn ? 'Fictional demo interface' : 'काल्पनिक डेमो इंटरफ़ेस'}</span><span className="fake-button">{isEn ? 'Continue' : 'जारी रखें'} <ArrowRight size={12} /></span></div>
    </div>
  );
}

interface DragState {
  kind: 'draw' | 'move' | 'resize';
  startX: number;
  startY: number;
  index?: number;
  original?: RedactionMask;
}

function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [plainLanguage, setPlainLanguage] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryHint, setCategoryHint] = useState('');
  const [jurisdictionHint, setJurisdictionHint] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [flatPreviewUrl, setFlatPreviewUrl] = useState<string | null>(null);
  const [masks, setMasks] = useState<RedactionMask[]>([]);
  const [draftMask, setDraftMask] = useState<RedactionMask | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [manualError, setManualError] = useState('');
  const [manualNotice, setManualNotice] = useState(false);
  const [feedback, setFeedback] = useState<'yes' | 'not-yet' | null>(null);
  const [toast, setToast] = useState('');
  const [speechActive, setSpeechActive] = useState(false);
  const [activeStage, setActiveStage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);

  const current = uiText[locale];
  const text = (key: keyof typeof uiText.en) => String(current[key]);
  const demo = useMemo(() => demoCases.find((item) => item.id === selectedId) ?? null, [selectedId]);
  const coverage = demo ? getEvidenceCoverage(demo.findings) : null;
  const selectedStatusLabels: Record<EvidenceStatus, string> = { confirmed: text('confirmed'), likely: text('likely'), unknown: text('unknown') };

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!flatPreviewUrl) return;
    return () => URL.revokeObjectURL(flatPreviewUrl);
  }, [flatPreviewUrl]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    function onWindowPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      const image = files.find((file) => file.type.startsWith('image/'));
      if (image) {
        event.preventDefault();
        acceptFile(image);
      }
    }
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  });

  useEffect(() => {
    if (!demo) return;
    const updateStage = () => {
      const recover = document.getElementById('recovery')?.getBoundingClientRect();
      const verify = document.getElementById('verification')?.getBoundingClientRect();
      if (recover && recover.top < window.innerHeight * 0.55) setActiveStage(3);
      else if (verify && verify.top < window.innerHeight * 0.65) setActiveStage(2);
      else setActiveStage(1);
    };
    window.addEventListener('scroll', updateStage, { passive: true });
    return () => window.removeEventListener('scroll', updateStage);
  }, [demo]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }

  function acceptFile(file: File) {
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setImageError(validation.reason === 'size' ? text('imageTooLarge') : text('imageInvalid'));
      return;
    }
    setImageError(null);
    setMasks([]);
    setDraftMask(null);
    setFlatPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setImageFile(file);
  }

  function removeImage() {
    setImageFile(null);
    setMasks([]);
    setDraftMask(null);
    setImageError(null);
    setFlatPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  function openDemo(id: string) {
    setSelectedId(id);
    setCompleted(new Set());
    setFeedback(null);
    setManualNotice(false);
    setLiveMode(false);
    setActiveStage(1);
    window.setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }

  function resetWork() {
    setSelectedId(null);
    setCategoryHint('');
    setJurisdictionHint('');
    setContextNote('');
    setCompleted(new Set());
    setFeedback(null);
    setManualError('');
    setManualNotice(false);
    setLiveMode(false);
    removeImage();
    setActiveStage(1);
    notify(text('resetConfirm'));
  }

  function goTo(id: string, stage?: number) {
    if (stage) setActiveStage(stage);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleManualOpen() {
    if (!manualError.trim()) {
      setManualNotice(true);
      notify(locale === 'en' ? 'Type the exact error text first.' : 'पहले त्रुटि का सही पाठ लिखें।');
      return;
    }
    setManualNotice(true);
    setLiveMode(false);
  }

  function toggleStep(step: RecoveryStep) {
    setCompleted((old) => {
      const next = new Set(old);
      if (next.has(step.id)) next.delete(step.id);
      else next.add(step.id);
      return next;
    });
  }

  async function copyReport() {
    if (!demo) return;
    const success = await copyText(buildWhatsAppMessage(demo, completed, locale));
    notify(success ? text('copySuccess') : text('copyFail'));
  }

  function readReport() {
    if (!demo) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      notify(text('speechUnavailable'));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(buildSpeechText(demo, completed, locale, plainLanguage));
    utterance.lang = locale === 'hi' ? 'hi-IN' : 'en-US';
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(locale === 'hi' ? 'hi' : 'en'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      setSpeechActive(true);
      notify(text('speechStarted'));
    };
    utterance.onend = () => setSpeechActive(false);
    utterance.onerror = () => {
      setSpeechActive(false);
      notify(text('speechUnavailable'));
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeechActive(false);
  }

  async function createFlattenedPreview() {
    if (!imageFile || !masks.length) return;
    try {
      const flattened = await flattenRedactions(imageFile, masks);
      const url = URL.createObjectURL(flattened);
      setFlatPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch {
      setImageError(text('imageReadError'));
    }
  }

  function pointOnImage(clientX: number, clientY: number) {
    const rect = imageWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }

  function onImagePointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('.mask-overlay')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOnImage(event.clientX, event.clientY);
    setDragState({ kind: 'draw', startX: point.x, startY: point.y });
    setDraftMask({ x: point.x, y: point.y, width: 0, height: 0 });
    setFlatPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  function onMaskPointerDown(event: PointerEvent<HTMLElement>, index: number, kind: 'move' | 'resize') {
    event.stopPropagation();
    imageWrapRef.current?.setPointerCapture(event.pointerId);
    const point = pointOnImage(event.clientX, event.clientY);
    setDragState({ kind, index, startX: point.x, startY: point.y, original: { ...masks[index] } });
  }

  function onMaskKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!arrows.includes(event.key) && event.key !== 'Delete' && event.key !== 'Backspace') return;
    event.preventDefault();
    if (event.key === 'Delete' || event.key === 'Backspace') {
      setMasks((old) => old.filter((_, currentIndex) => currentIndex !== index));
    } else {
      const delta = event.altKey ? 0.01 : 0.025;
      setMasks((old) => old.map((mask, currentIndex) => {
        if (currentIndex !== index) return mask;
        if (event.shiftKey) {
          if (event.key === 'ArrowLeft') return { ...mask, width: Math.max(0.025, mask.width - delta) };
          if (event.key === 'ArrowRight') return { ...mask, width: Math.min(1 - mask.x, mask.width + delta) };
          if (event.key === 'ArrowUp') return { ...mask, height: Math.max(0.025, mask.height - delta) };
          return { ...mask, height: Math.min(1 - mask.y, mask.height + delta) };
        }
        if (event.key === 'ArrowLeft') return { ...mask, x: Math.max(0, mask.x - delta) };
        if (event.key === 'ArrowRight') return { ...mask, x: Math.min(1 - mask.width, mask.x + delta) };
        if (event.key === 'ArrowUp') return { ...mask, y: Math.max(0, mask.y - delta) };
        return { ...mask, y: Math.min(1 - mask.height, mask.y + delta) };
      }));
    }
    setFlatPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  function onImagePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    const point = pointOnImage(event.clientX, event.clientY);
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;
    if (dragState.kind === 'draw') {
      setDraftMask({ x: Math.min(dragState.startX, point.x), y: Math.min(dragState.startY, point.y), width: Math.abs(dx), height: Math.abs(dy) });
      return;
    }
    const initial = dragState.original;
    const index = dragState.index;
    if (!initial || index === undefined) return;
    setMasks((old) => old.map((mask, currentIndex) => {
      if (currentIndex !== index) return mask;
      if (dragState.kind === 'move') {
        return { ...initial, x: Math.max(0, Math.min(1 - initial.width, initial.x + dx)), y: Math.max(0, Math.min(1 - initial.height, initial.y + dy)) };
      }
      return { ...initial, width: Math.max(0.025, Math.min(1 - initial.x, initial.width + dx)), height: Math.max(0.025, Math.min(1 - initial.y, initial.height + dy)) };
    }));
    setFlatPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  function onImagePointerUp() {
    if (dragState?.kind === 'draw' && draftMask && draftMask.width > 0.012 && draftMask.height > 0.012) {
      setMasks((old) => [...old, draftMask]);
    }
    setDraftMask(null);
    setDragState(null);
  }

  const startSample = () => openDemo(demoCases[0].id);
  const faqList = current.faq as [string, string][];
  const limitations = current.limits as string[];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">{locale === 'en' ? 'Skip to content' : 'मुख्य सामग्री पर जाएँ'}</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="FormRescue AI home">
          <span className="brand-mark"><FileCheck2 size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">Form<span>Rescue</span><small>AI</small></span>
        </a>
        <nav className="main-nav" aria-label={locale === 'en' ? 'Main navigation' : 'मुख्य नेविगेशन'}>
          <a href="#how-it-works">{text('navHow')}</a>
          <a href="#workspace">{text('navCases')}</a>
          <a href="#limits">{text('navLimits')}</a>
        </nav>
        <div className="header-actions">
          <label className="language-select"><Languages size={16} aria-hidden="true" /><span className="sr-only">{text('navLanguage')}</span><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={text('navLanguage')}><option value="en">English</option><option value="hi">हिन्दी</option></select><ChevronDown size={13} aria-hidden="true" /></label>
          <button className="button button-small button-primary header-cta" onClick={startSample}>{text('trySample')}<ArrowRight size={15} /></button>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="kicker-dot" />{text('eyebrow')}</div>
            <h1>{text('title')}</h1>
            <p className="hero-lede">{text('subtitle')}</p>
            <div className="hero-actions">
              <button className="button button-primary button-large" onClick={startSample}>{text('trySample')}<ArrowRight size={18} /></button>
              <button className="button button-secondary button-large" onClick={() => goTo('upload-card', 1)}><FileImage size={17} />{text('uploadScreenshot')}</button>
            </div>
            <div className="hero-proof"><ShieldCheck size={16} /><span>{text('heroNote')}</span><span className="hero-proof-sep" /><span>{locale === 'en' ? 'No application data is saved' : 'आवेदन की जानकारी सेव नहीं होती'}</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-grid" />
            <div className="art-orbit art-orbit-one" /><div className="art-orbit art-orbit-two" />
            <div className="art-card art-error"><div className="art-card-top"><span className="art-tiny-dot" /><span className="art-tiny-line" /><span className="art-menu-dot">•••</span></div><div className="art-error-message"><CircleAlert size={18} /><span>{text('visualError')}</span></div><div className="art-red-line"><i /></div><div className="art-muted-lines"><i /><i /></div></div>
            <div className="art-connector"><span /><span /><span /></div>
            <div className="art-card art-plan"><div className="art-plan-head"><span className="art-plan-icon"><FileCheck2 size={18} /></span><span>{locale === 'en' ? 'Next step' : 'अगला कदम'}</span><CheckCircle2 size={16} /></div><div className="art-plan-row"><span className="art-check"><Check size={11} /></span><span>{text('visualStep')}</span></div><div className="art-plan-row"><span className="art-empty-check" /><span>{locale === 'en' ? 'Keep a copy of the receipt' : 'रसीद की प्रति रखें'}</span></div><div className="art-plan-foot"><span className="art-strength-dot" /><span>{text('visualDone')}</span><ArrowUpRight size={14} /></div></div>
            <div className="art-sticker"><Sparkles size={15} /><span>{locale === 'en' ? 'Less guesswork' : 'कम अनुमान'}</span></div>
            <div className="hero-art-caption"><span>01</span> {locale === 'en' ? 'A message, made manageable.' : 'संदेश को समझना आसान।'}</div>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <SectionHeading eyebrow={text('howLabel')} title={text('howTitle')} />
          <div className="how-steps">
            {(['understand', 'verify', 'recover'] as const).map((step, index) => {
              const Icon = [FileText, ShieldCheck, ArrowUpRight][index];
              const description = current[`${step}Text` as 'understandText' | 'verifyText' | 'recoverText'];
              return <article className="how-step" key={step}><div className="how-step-top"><span className="how-num">0{index + 1}</span><span className="how-icon"><Icon size={18} /></span></div><h3>{text(step)}</h3><p>{description}</p></article>;
            })}
          </div>
        </section>

        <section className="workspace-section" id="workspace">
          <SectionHeading eyebrow={text('workspaceEyebrow')} title={text('workspaceTitle')} description={text('workspaceIntro')} />
          <div className="mode-bar">
            <div className="mode-bar-copy"><span className={`mode-dot ${liveMode ? 'mode-dot-off' : ''}`} /><div><strong>{liveMode ? text('liveToggle') : text('demoMode')}</strong><span>{liveMode ? (liveAnalysisAdapter.status === 'not-configured' ? text('notConfigured') : (locale === 'en' ? 'Connected' : 'संपर्क किया गया')) : (locale === 'en' ? 'Ready · works offline' : 'तैयार · ऑफ़लाइन चलता है')}</span></div></div>
            <div className="mode-switches"><label className="switch-label"><span>{text('simpleMode')}</span><input type="checkbox" checked={plainLanguage} onChange={(event) => setPlainLanguage(event.target.checked)} aria-label={text('simpleMode')} /><span className="switch-track"><i /></span></label><label className="switch-label"><span>{text('liveToggle')}</span><input type="checkbox" checked={liveMode} onChange={(event) => setLiveMode(event.target.checked)} aria-label={text('liveToggle')} /><span className="switch-track"><i /></span></label></div>
          </div>

          <div className="stepper" aria-label={locale === 'en' ? 'Recovery steps' : 'समाधान के चरण'}>
            {[
              { n: 1, label: text('stageUnderstand'), target: 'understand-panel' },
              { n: 2, label: text('stageVerify'), target: 'verification' },
              { n: 3, label: text('stageRecover'), target: 'recovery' },
            ].map((item, index) => <button key={item.n} className={`stepper-item ${activeStage === item.n ? 'stepper-active' : ''} ${activeStage > item.n ? 'stepper-done' : ''}`} onClick={() => goTo(item.target, item.n)} aria-current={activeStage === item.n ? 'step' : undefined}><span className="stepper-number">{activeStage > item.n ? <Check size={13} /> : `0${item.n}`}</span><span>{item.label}</span>{index < 2 && <i className="stepper-line" />}</button>)}
          </div>

          {liveMode ? (
            <div className="live-configuration" role="status">
              <div className="live-icon"><LockKeyhole size={23} /></div>
              <div className="live-content"><span className="eyebrow">{text('providerStatus')} · {text('notConfigured')}</span><h3>{text('liveTitle')}</h3><p>{text('liveBody')}</p><div className="live-missing"><strong>{text('liveMissing')}</strong><div>{liveAnalysisAdapter.missingCapabilities[locale].join(' · ')}</div></div><button className="button button-secondary" onClick={() => setLiveMode(false)}>{text('switchDemo')}<ArrowRight size={15} /></button></div>
              <div className="live-stamp"><CircleAlert size={14} />{text('notConfigured')}</div>
            </div>
          ) : (
            <>
              <div className="workspace-grid" id="understand-panel">
                <section className="work-card case-picker-card" aria-labelledby="case-heading">
                  <div className="work-card-heading"><div><span className="card-step-label"><span>01</span>{text('stageUnderstand')}</span><h3 id="case-heading">{text('chooseCase')}</h3><p>{text('chooseCaseHint')}</p></div><span className="card-heading-icon"><FileText size={18} /></span></div>
                  <div className="case-list">
                    {demoCases.map((sample, index) => <button key={sample.id} className={`case-option ${selectedId === sample.id ? 'case-option-selected' : ''}`} onClick={() => openDemo(sample.id)}>
                      <span className={`case-index case-index-${index + 1}`}>0{index + 1}</span><span className="case-option-copy"><strong>{sample.shortName[locale]}</strong><small>{sample.institution[locale]}</small></span>{selectedId === sample.id ? <CheckCircle2 size={18} className="case-selected-icon" /> : <ArrowUpRight size={16} className="case-open-icon" />}
                    </button>)}
                  </div>
                  <div className="field-row"><label htmlFor="category">{text('category')}</label><select id="category" value={categoryHint} onChange={(event) => setCategoryHint(event.target.value)}><option value="">{text('categoryPlaceholder')}</option>{demoCases.map((sample) => <option key={sample.id} value={sample.id}>{sample.category[locale]}</option>)}</select></div>
                  <div className="field-row"><label htmlFor="jurisdiction">{text('jurisdiction')}</label><input id="jurisdiction" type="text" value={jurisdictionHint} onChange={(event) => setJurisdictionHint(event.target.value)} placeholder={text('jurisdictionPlaceholder')} autoComplete="off" /></div>
                  <div className="field-row"><label htmlFor="context">{text('context')}</label><textarea id="context" rows={2} value={contextNote} onChange={(event) => setContextNote(event.target.value)} placeholder={text('contextPlaceholder')} /></div>
                  <p className="field-helper">{text('demoContextNote')}</p>
                </section>

                <section className="work-card upload-card" id="upload-card" aria-labelledby="upload-heading">
                  <div className="work-card-heading"><div><span className="card-step-label"><span>01</span>{text('stageUnderstand')}</span><h3 id="upload-heading">{text('uploadTitle')}</h3><p>{text('uploadHint')}</p></div><span className="card-heading-icon"><FileImage size={18} /></span></div>
                  <div className="privacy-alert"><ShieldCheck size={17} /><p>{text('privacyWarning')}</p></div>
                  <div className={`drop-zone ${imageFile ? 'drop-zone-filled' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) acceptFile(file); }} onPaste={(event) => { const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/')); if (file) { event.preventDefault(); acceptFile(file); } }} tabIndex={0} aria-label={text('uploadHint')}>
                    {!imageFile ? <><span className="upload-icon"><FileImage size={22} /></span><strong>{text('uploadHint')}</strong><span className="file-types">{text('fileTypes')}</span><button className="button button-secondary browse-button" onClick={() => fileInputRef.current?.click()}><FileImage size={15} />{text('browse')}</button><small>{text('pasteHint')}</small></> : <div className="image-file-top"><span className="upload-icon upload-icon-small"><FileImage size={17} /></span><div><strong>{imageFile.name}</strong><small>{(imageFile.size / 1024 / 1024).toFixed(2)} MB · {text('demoMode')}</small></div><button className="icon-button" aria-label={text('removeImage')} onClick={removeImage}><X size={17} /></button></div>}
                    <input ref={fileInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) acceptFile(file); event.currentTarget.value = ''; }} aria-label={text('browse')} />
                  </div>
                  {imageError && <p className="field-error" role="alert"><CircleAlert size={15} />{imageError}</p>}
                  {imageFile && previewUrl && <div className="local-preview">
                    <div className="local-preview-heading"><span><ShieldCheck size={15} />{text('demoPrivacy')}</span><button className="text-button" onClick={removeImage}>{text('removeImage')}</button></div>
                    <p className="local-preview-note">{text('noImageAnalysis')}</p>
                    <div className="image-editor-help"><strong>{text('redact')}</strong><p>{text('redactHelp')}</p><p id="redaction-keyboard-help">{locale === 'en' ? 'Keyboard: focus a cover; use arrow keys to move, Shift + arrows to resize, and Delete to remove. Use the button below to add a centered cover.' : 'कीबोर्ड: आवरण पर फ़ोकस करें; तीर कुंजियों से खिसकाएँ, Shift + तीर से आकार बदलें, Delete से हटाएँ। नीचे दिए बटन से बीच में नया आवरण जोड़ें।'}</p></div>
                    <div className="image-editor-stage"><div className="image-wrap" ref={imageWrapRef} onPointerDown={onImagePointerDown} onPointerMove={onImagePointerMove} onPointerUp={onImagePointerUp} onPointerCancel={onImagePointerUp}>
                      <img src={previewUrl} alt={locale === 'en' ? 'Local screenshot preview. No text has been identified.' : 'स्थानीय स्क्रीनशॉट पूर्वावलोकन। किसी पाठ की पहचान नहीं हुई है।'} draggable={false} onError={() => setImageError(text('imageReadError'))} />
                      {masks.map((mask, index) => <div key={index} className="mask-overlay" role="group" tabIndex={0} aria-describedby="redaction-keyboard-help" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Delete Backspace" aria-label={`${locale === 'en' ? 'Redaction cover' : 'आवरण'} ${index + 1}. ${locale === 'en' ? 'Use arrow keys to move; Shift and arrow keys to resize; Delete to remove.' : 'तीर कुंजियों से खिसकाएँ; Shift और तीर से आकार बदलें; Delete से हटाएँ।'}`} style={{ left: `${mask.x * 100}%`, top: `${mask.y * 100}%`, width: `${mask.width * 100}%`, height: `${mask.height * 100}%` }} onKeyDown={(event) => onMaskKeyDown(event, index)} onPointerDown={(event) => onMaskPointerDown(event, index, 'move')}><span>{locale === 'en' ? 'Covered' : 'ढका हुआ'}</span><span className="mask-resize" aria-hidden="true" onPointerDown={(event) => onMaskPointerDown(event, index, 'resize')} /></div>)}
                      {draftMask && <div className="mask-overlay mask-draft" style={{ left: `${draftMask.x * 100}%`, top: `${draftMask.y * 100}%`, width: `${draftMask.width * 100}%`, height: `${draftMask.height * 100}%` }} />}
                    </div></div>
                    <div className="redaction-controls"><span className="redaction-count">{masks.length} {text('masksCount')}</span><button className="text-button" onClick={() => setMasks((old) => [...old, { x: .35, y: .35, width: .3, height: .15 }])}>{locale === 'en' ? 'Add centered cover' : 'बीच में आवरण जोड़ें'}</button><button className="text-button" onClick={() => setMasks((old) => old.slice(0, -1))} disabled={!masks.length}><RotateCcw size={14} />{text('undoMask')}</button><button className="text-button" onClick={() => setMasks([])} disabled={!masks.length}>{text('clearMasks')}</button><button className="button button-small button-secondary" onClick={createFlattenedPreview} disabled={!masks.length}>{locale === 'en' ? 'Preview flattened copy' : 'ढकी हुई प्रति देखें'}</button></div>
                    {masks.length > 0 && <div className="mask-list">{masks.map((_, index) => <div key={index}><span>{text('solidCover')} {index + 1} · {locale === 'en' ? 'Arrow keys move; Shift + arrows resize; Delete removes' : 'तीर कुंजियाँ: खिसकाएँ; Shift + तीर: आकार बदलें; Delete: हटाएँ'}</span><button className="icon-button icon-button-small" onClick={() => setMasks((old) => old.filter((__, itemIndex) => itemIndex !== index))} aria-label={`${locale === 'en' ? 'Remove cover' : 'आवरण हटाएँ'} ${index + 1}`}><X size={14} /></button></div>)}</div>}
                    {flatPreviewUrl && <div className="flattened-preview"><div><CheckCircle2 size={16} /><strong>{locale === 'en' ? 'Flattened redaction preview' : 'स्थायी आवरण का पूर्वावलोकन'}</strong></div><p>{locale === 'en' ? 'Solid masks are burned into this separate PNG. This build does not send either image to an AI provider.' : 'ठोस आवरण इस अलग PNG में स्थायी रूप से जुड़ गया है। यह संस्करण कोई भी तस्वीर AI प्रदाता को नहीं भेजता।'}</p><img src={flatPreviewUrl} alt={locale === 'en' ? 'Preview of the flattened screenshot with solid redactions' : 'ठोस आवरण के साथ स्थायी स्क्रीनशॉट पूर्वावलोकन'} /></div>}
                  </div>}
                  <div className="manual-entry"><label htmlFor="manual-error">{text('manualText')}</label><textarea id="manual-error" rows={3} value={manualError} onChange={(event) => { setManualError(event.target.value); setManualNotice(false); }} placeholder={text('manualPlaceholder')} /><button className="button button-secondary manual-submit" onClick={handleManualOpen}><ArrowRight size={15} />{text('analyzeDemo')}</button>{manualNotice && <p className="manual-notice" role="status">{locale === 'en' ? 'This text is held only in this page. No analysis was performed because live AI is not configured. Choose a sample report above to explore the demo.' : 'यह पाठ केवल इसी पेज पर रहता है। लाइव AI सेट न होने से कोई विश्लेषण नहीं हुआ। डेमो देखने के लिए ऊपर नमूना रिपोर्ट चुनें।'}</p>}</div>
                </section>
              </div>

              {demo && <section className="report-area" id="report" aria-labelledby="report-heading">
                <div className="report-header"><div><span className="eyebrow"><span className="report-dot" />{text('reportLabel')} · {text('demoBadge')}</span><h2 id="report-heading">{text('reportTitle')}</h2><p>{demo.institution[locale]} <span className="report-divider">/</span> {demo.category[locale]}</p></div><div className="report-actions"><button className="button button-small button-secondary" onClick={readReport}><Volume2 size={15} />{text('readAloud')}</button>{speechActive && <button className="button button-small button-secondary" onClick={stopSpeech}><VolumeX size={15} />{text('stopReading')}</button>}<button className="button button-small button-secondary" onClick={copyReport}><MessageCircle size={15} />{text('copyPlan')}</button><button className="button button-small button-primary" onClick={() => window.print()}><FileText size={15} />{text('print')}</button></div></div>
                <div className="report-toolbar"><nav className="report-tabs" aria-label={locale === 'en' ? 'Report sections' : 'रिपोर्ट अनुभाग'}><button className={activeStage === 1 ? 'report-tab-active' : ''} onClick={() => goTo('report', 1)}><span>01</span>{text('stageUnderstand')}</button><button className={activeStage === 2 ? 'report-tab-active' : ''} onClick={() => goTo('verification', 2)}><span>02</span>{text('stageVerify')}</button><button className={activeStage === 3 ? 'report-tab-active' : ''} onClick={() => goTo('recovery', 3)}><span>03</span>{text('stageRecover')}</button></nav><button className="text-button reset-link" onClick={resetWork}><RotateCcw size={14} />{text('startOver')}</button></div>
                <div className="report-overview">
                  <div className="report-summary-card"><div className="summary-card-top"><span className="summary-icon"><Info size={17} /></span><span className="demo-pill">{text('demoBadge')}</span></div><h3>{text('issueSummary')}</h3><p>{plainLanguage ? demo.plainSummary[locale] : demo.summary[locale]}</p><div className="summary-error"><CircleAlert size={16} /><span>{demo.error[locale]}</span></div></div>
                  <div className="report-portal-card"><div className="mini-section-title"><span>{text('portalScreen')}</span><span className="mini-lock"><LockKeyhole size={12} />{text('portalSample')}</span></div><PortalPreview demo={demo} locale={locale} /></div>
                </div>

                <section className="evidence-section" id="verification">
                  <div className="evidence-section-head"><div><span className="card-step-label"><span>02</span>{text('stageVerify')}</span><h3>{text('evidenceTitle')}</h3><p>{text('evidenceIntro')}</p></div>{coverage && <div className="coverage-card"><div className="coverage-ring" style={{ '--coverage': `${coverage.score}%` } as CSSProperties}><div><strong>{coverage.score}%</strong></div></div><div><strong>{text('confidenceTitle')}</strong><span>{coverage.confirmed}/{coverage.total} {locale === 'en' ? 'directly supported' : 'सीधे समर्थित'}</span></div><button className="coverage-info" title={text('confidenceExplain')} aria-label={text('confidenceExplain')}><Info size={15} /></button></div>}</div>
                  <p className="coverage-caption">{text('confidenceExplain')}</p>
                  <div className="evidence-legend"><span><EvidenceBadge status="confirmed" label={text('confirmed')} /><small>{text('confirmedExplain')}</small></span><span><EvidenceBadge status="likely" label={text('likely')} /><small>{text('likelyExplain')}</small></span><span><EvidenceBadge status="unknown" label={text('unknown')} /><small>{text('unknownExplain')}</small></span></div>
                  <div className="finding-list">{demo.findings.map((finding) => <article className={`finding-card finding-${finding.status}`} key={finding.id}><div className="finding-status"><EvidenceBadge status={finding.status} label={selectedStatusLabels[finding.status]} /></div><div className="finding-content"><h4>{finding.text[locale]}</h4><p>{finding.why[locale]}</p>{finding.whatWouldHelp && <div className="resolve-hint"><ArrowRight size={14} /><span>{finding.whatWouldHelp[locale]}</span></div>}</div></article>)}</div>
                  <div className="sources-area"><h4><FileCheck2 size={16} />{text('sourceTitle')}</h4>{demo.sources.map((source) => <article className="source-card" key={source.id}><div className="source-card-top"><span className="source-fiction-label"><Info size={13} />{text('sourceLabel')}</span><span className="source-id">{source.id}</span></div><h5>{source.title[locale]}</h5><div className="source-meta"><strong>{text('publisher')}:</strong> {source.publisher[locale]}</div><p><strong>{text('excerpt')}:</strong> {source.excerpt[locale]}</p><span className="source-unavailable">{locale === 'en' ? 'No live URL or retrieval timestamp — this is an internal fictional source.' : 'कोई लाइव URL या प्राप्ति समय नहीं — यह आंतरिक काल्पनिक स्रोत है।'}</span></article>)}</div>
                </section>

                <section className="recovery-section" id="recovery">
                  <div className="recovery-head"><div><span className="card-step-label"><span>03</span>{text('stageRecover')}</span><h3>{text('recoveryTitle')}</h3><p>{text('recoveryIntro')}</p></div><div className="progress-counter"><span>{completed.size}/{demo.steps.length}</span><small>{text('progress')}</small></div></div>
                  <div className="recovery-content-grid"><div className="checklist-panel">{demo.steps.map((step, index) => { const done = completed.has(step.id); return <article className={`recovery-step ${done ? 'recovery-step-done' : ''}`} key={step.id}><button className="step-check" onClick={() => toggleStep(step)} aria-label={`${done ? text('completed') : text('complete')}: ${step.title[locale]}`} aria-pressed={done}>{done && <Check size={15} />}</button><div className="recovery-step-content"><div className="step-title-row"><span className="step-count">{String(index + 1).padStart(2, '0')}</span><h4>{step.title[locale]}</h4>{done && <span className="done-chip"><CheckCircle2 size={13} />{text('completed')}</span>}</div><p>{step.description[locale]}</p><div className="step-detail"><span><Sparkles size={13} /><strong>{locale === 'en' ? 'Why it may help' : 'यह क्यों मदद कर सकता है'}:</strong> {step.why[locale]}</span>{step.duration && <span><ArrowDown size={13} /><strong>{text('duration')}:</strong> {step.duration[locale]} <i>({locale === 'en' ? 'estimate' : 'अनुमान'})</i></span>}{step.prerequisite && <span><Info size={13} /><strong>{text('prerequisite')}:</strong> {step.prerequisite[locale]}</span>}<span className="verify-detail"><CheckCircle2 size={13} /><strong>{text('verifySuccess')}:</strong> {step.verify[locale]}</span></div></div></article>; })}</div>
                    <aside className="recovery-aside">
                      <InfoList title={text('missingTitle')} items={demo.missingDocuments[locale]} icon="file" />
                      <InfoList title={text('questionsTitle')} items={demo.questions[locale]} icon="help" />
                      <InfoList title={text('unverifiedTitle')} items={demo.findings.filter((finding) => finding.status === 'unknown').map((finding) => finding.text[locale])} icon="unknown" />
                      <InfoList title={text('verificationTitle')} items={demo.verification[locale]} icon="check" />
                      <InfoList title={text('ifFailsTitle')} items={demo.ifFails[locale]} icon="arrow" />
                    </aside></div>
                </section>
                <div className="report-bottom-actions"><button className="button button-secondary" onClick={copyReport}><MessageCircle size={16} />{text('copyPlan')}</button><button className="button button-secondary" onClick={() => window.print()}><FileText size={16} />{text('print')}</button><button className="button button-primary" onClick={resetWork}><RotateCcw size={16} />{text('newAnalysis')}</button></div>
                <div className="feedback-card"><div><span className="feedback-icon"><MessageCircle size={16} /></span><div><strong>{text('feedbackTitle')}</strong>{feedback && <p role="status">{text('feedbackThanks')}</p>}</div></div><div className="feedback-actions"><button className={`button button-small ${feedback === 'yes' ? 'button-primary' : 'button-secondary'}`} onClick={() => setFeedback('yes')}>{text('feedbackYes')}</button><button className={`button button-small ${feedback === 'not-yet' ? 'button-primary' : 'button-secondary'}`} onClick={() => setFeedback('not-yet')}>{text('feedbackNo')}</button></div></div>
              </section>}
            </>
          )}
        </section>

        <section className="comparison-section" id="before-after">
          <div className="comparison-intro"><SectionHeading eyebrow={text('beforeAfter')} title={locale === 'en' ? 'A confusing line can become a clear next step.' : 'उलझी पंक्ति से साफ़ अगला कदम।'} description={locale === 'en' ? 'Here is a fictional example of what careful, evidence-aware help looks like.' : 'यहाँ सावधान, प्रमाण-आधारित मदद का काल्पनिक उदाहरण है।'} /></div>
          <div className="comparison-grid"><div className="comparison-original"><div className="comparison-label"><span className="comparison-label-dot comparison-red" />{text('beforeTitle')}<span className="demo-pill">{text('demoBadge')}</span></div><div className="comparison-error"><CircleAlert size={18} />{demoCases[0].error[locale]}</div><div className="comparison-portal-caption"><FileImage size={14} />{demoCases[0].institution[locale]} · {text('portalDisclaimer')}</div></div><div className="comparison-arrow"><ArrowRight size={22} /></div><div className="comparison-explanation"><div className="comparison-label"><span className="comparison-label-dot comparison-green" />{text('afterTitle')}</div><p>{demoCases[0].plainSummary[locale]}</p><div className="comparison-next"><span className="mini-check"><Check size={13} /></span><span>{demoCases[0].steps[0].title[locale]}</span><ArrowUpRight size={15} /></div></div></div>
        </section>

        <section className="difference-section">
          <div className="difference-icon"><ShieldCheck size={21} /></div><div><span className="eyebrow">{locale === 'en' ? 'Evidence-first by design' : 'प्रमाण पहले, यही तरीका'}</span><h2>{text('whyDifferentTitle')}</h2><p>{text('whyDifferent')}</p></div><div className="difference-note"><CheckCircle2 size={17} /><span>{locale === 'en' ? 'Confirmed · Likely · Unknown' : 'पुष्ट · संभावित · अज्ञात'}</span></div>
        </section>

        <section className="privacy-section" id="privacy"><div className="privacy-icon"><LockKeyhole size={20} /></div><div><span className="eyebrow">{text('privacyTitle')}</span><p>{text('privacyBody')}</p></div></section>

        <section className="limits-section" id="limits">
          <div className="limits-heading"><div><span className="eyebrow">{locale === 'en' ? 'Stay in control' : 'नियंत्रण आपके पास'}</span><h2>{text('limitTitle')}</h2><p>{text('limitIntro')}</p></div><span className="limits-icon"><ShieldCheck size={22} /></span></div>
          <div className="limits-grid">{limitations.map((item, index) => <div className="limit-item" key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>)}</div><div className="authority-note"><Info size={17} /><p>{text('consultAuthority')}</p></div>
        </section>

        <section className="faq-section" id="faq"><SectionHeading eyebrow={locale === 'en' ? 'Good to know' : 'जानना उपयोगी है'} title={text('faqTitle')} /><div className="faq-list">{faqList.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}<ChevronDown size={17} /></summary><p>{answer}</p></details>)}</div></section>

        <section className="final-cta"><div className="final-cta-mark"><FileCheck2 size={21} /></div><div><span className="eyebrow">{locale === 'en' ? 'Ready when you are' : 'जब चाहें, शुरू करें'}</span><h2>{locale === 'en' ? 'Take the next step with a little more clarity.' : 'थोड़ी और स्पष्टता के साथ अगला कदम लें।'}</h2></div><button className="button button-primary button-large" onClick={startSample}>{text('trySample')}<ArrowRight size={17} /></button></section>
      </main>

      <footer className="site-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark"><FileCheck2 size={17} /></span><span className="brand-name">Form<span>Rescue</span><small>AI</small></span></a><div className="footer-center"><span>{text('footerLine')}</span><small>{text('footerPrivacy')}</small></div><div className="footer-links"><a href="#privacy">{locale === 'en' ? 'Privacy' : 'गोपनीयता'}</a><a href="#limits">{text('navLimits')}</a><a href="#faq">FAQ</a></div></footer>
      <div className="toast" role="status" aria-live="polite" data-visible={Boolean(toast)}>{toast}</div>
      <div className="print-only print-report">{demo && <><h1>FormRescue AI — {demo.institution[locale]}</h1><p>{demo.summary[locale]}</p><h2>{text('evidenceTitle')}</h2>{demo.findings.map((finding) => <p key={finding.id}><strong>{selectedStatusLabels[finding.status]}:</strong> {finding.text[locale]} — {finding.why[locale]}</p>)}<h2>{text('recoveryTitle')}</h2>{demo.steps.map((step) => <div className="print-step" key={step.id}><p><strong>[{completed.has(step.id) ? 'x' : ' '}] {step.title[locale]}</strong></p><p>{step.description[locale]} {text('verifySuccess')}: {step.verify[locale]}</p></div>)}<h2>{text('sourceTitle')}</h2>{demo.sources.map((source) => <p key={source.id}><strong>{source.title[locale]}</strong> — {source.publisher[locale]} ({source.id}; fictional demo source)<br />{source.excerpt[locale]}</p>)}<h2>{text('limitTitle')}</h2><p>{text('consultAuthority')}</p><ul>{limitations.map((item) => <li key={item}>{item}</li>)}</ul></>}</div>
    </div>
  );
}

function InfoList({ title, items, icon }: { title: string; items: string[]; icon: 'file' | 'help' | 'unknown' | 'check' | 'arrow' }) {
  const Icon = { file: FileText, help: HelpCircle, unknown: Info, check: CheckCircle2, arrow: ArrowRight }[icon];
  return <section className="info-list"><h4><Icon size={14} />{title}</h4><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}

export default App;
