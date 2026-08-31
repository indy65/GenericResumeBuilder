#!/usr/bin/env node
// ResumeBuilder — Static multilingual page generator
// Run: node i18n/generate.js
// Output: /en/, /fr/, /es/, /pt/, /de/ directories with index.html + privacy-policy.html
// Also outputs: sitemap.xml, robots.txt, _redirects (root)

'use strict';
const fs = require('fs');
const path = require('path');
const { LANGS, LANG_META } = require('./translations.js');

const SITE_URL = 'https://resumebuilder.pages.dev'; // ← update with your real domain
const SUPPORTED = Object.keys(LANGS);
const ROOT = path.resolve(__dirname, '..');

// ── HELPERS ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hreflangTags(currentPage) {
  // currentPage: 'index' | 'privacy'
  const filename = currentPage === 'index' ? 'index.html' : 'privacy-policy.html';
  const lines = SUPPORTED.map(lang =>
    `<link rel="alternate" hreflang="${lang}" href="${SITE_URL}/${lang}/${filename}"/>`
  );
  lines.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/en/${filename}"/>`);
  return lines.join('\n');
}

function canonicalTag(lang, page) {
  const filename = page === 'index' ? 'index.html' : 'privacy-policy.html';
  return `<link rel="canonical" href="${SITE_URL}/${lang}/${filename}"/>`;
}

const FAVICON = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='12' fill='%23C7D2FE'/%3E%3Crect x='14' y='10' width='36' height='44' rx='3' fill='%23FFFFFF'/%3E%3Cpolygon points='38%2C10 50%2C10 50%2C22' fill='%23A5B4FC'/%3E%3Cpolygon points='38%2C10 50%2C22 38%2C22' fill='%23FFFFFF'/%3E%3Crect x='18' y='28' width='18' height='3' rx='1.5' fill='%23818CF8'/%3E%3Crect x='18' y='33' width='13' height='2' rx='1' fill='%23DDE3F8'/%3E%3Crect x='18' y='39' width='28' height='2' rx='1' fill='%23DDE3F8'/%3E%3Crect x='18' y='43' width='24' height='2' rx='1' fill='%23DDE3F8'/%3E%3Crect x='18' y='47' width='26' height='2' rx='1' fill='%23DDE3F8'/%3E%3C%2Fsvg%3E"/>
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='40' fill='%23C7D2FE'/%3E%3Crect x='38' y='28' width='104' height='124' rx='8' fill='%23FFFFFF'/%3E%3Cpolygon points='108%2C28 142%2C28 142%2C62' fill='%23A5B4FC'/%3E%3Cpolygon points='108%2C28 142%2C62 108%2C62' fill='%23FFFFFF'/%3E%3Crect x='50' y='78' width='52' height='9' rx='4.5' fill='%23818CF8'/%3E%3Crect x='50' y='93' width='38' height='7' rx='3' fill='%23DDE3F8'/%3E%3Crect x='50' y='108' width='80' height='7' rx='3' fill='%23DDE3F8'/%3E%3Crect x='50' y='120' width='68' height='7' rx='3' fill='%23DDE3F8'/%3E%3Crect x='50' y='132' width='74' height='7' rx='3' fill='%23DDE3F8'/%3E%3C%2Fsvg%3E"/>`;

// ── LANGUAGE SELECTOR COMPONENT ───────────────────────────────────────────────
function langSelectorHTML(currentLang, page) {
  const filename = page === 'index' ? 'index.html' : 'privacy-policy.html';
  const options = SUPPORTED.map(lang => {
    const m = LANG_META[lang];
    const active = lang === currentLang ? ' class="ls-active"' : '';
    return `<a href="/${lang}/${filename}"${active} hreflang="${lang}">${m.flag} ${m.native}</a>`;
  }).join('');
  return `<div class="lang-selector" id="lang-sel">
  <button class="ls-btn" onclick="document.getElementById('lang-sel').classList.toggle('open')" aria-label="Select language">
    ${LANG_META[currentLang].flag} ${LANG_META[currentLang].native} <span class="ls-arrow">▾</span>
  </button>
  <div class="ls-dropdown">${options}</div>
</div>`;
}

const LANG_SELECTOR_CSS = `
/* ── LANGUAGE SELECTOR ── */
.lang-selector{position:relative;display:inline-block}
.ls-btn{display:flex;align-items:center;gap:6px;background:transparent;border:1.5px solid var(--bdr);border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;color:var(--txt);transition:border-color .15s}
.ls-btn:hover{border-color:var(--acc)}
.ls-arrow{font-size:10px;color:var(--muted);margin-left:2px}
.ls-dropdown{display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--surf);border:1.5px solid var(--bdr);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:200;min-width:160px;overflow:hidden}
.lang-selector.open .ls-dropdown{display:block}
.ls-dropdown a{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:13px;font-weight:500;color:var(--txt);text-decoration:none;transition:background .12s}
.ls-dropdown a:hover{background:var(--surf2)}
.ls-dropdown a.ls-active{background:var(--acc-lt);color:var(--acc);font-weight:700}
@media(max-width:640px){.ls-dropdown{right:auto;left:0}}
`;

const LANG_SELECTOR_JS = `
// Close lang selector when clicking outside
document.addEventListener('click',function(e){
  var sel=document.getElementById('lang-sel');
  if(sel&&!sel.contains(e.target))sel.classList.remove('open');
});
// Save language preference
var _lp=window.location.pathname.match(/^\\/([a-z]{2})\\//);
if(_lp)localStorage.setItem('rb1_lang',_lp[1]);
`;

// ── AD SLOT HTML (reused) ─────────────────────────────────────────────────────
function adSlot(size = 'leaderboard') {
  if (size === 'leaderboard') {
    return `<div style="padding:20px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:center">
  <div class="ad-slot">Advertisement · 728×90</div>
  <!-- AdSense: <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script> -->
</div>`;
  }
  if (size === 'rectangle') {
    return `<div style="padding:32px 24px;background:#fff;display:flex;justify-content:center;border-top:1px solid #e2e8f0">
  <div class="ad-slot" style="max-width:336px;min-height:280px;">Advertisement · 336×280</div>
  <!-- AdSense: <ins class="adsbygoogle" style="display:inline-block;width:336px;height:280px" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script> -->
</div>`;
  }
  if (size === 'footer') {
    return `<div style="padding:24px;background:var(--surf2);border-top:1px solid var(--bdr);display:flex;justify-content:center">
  <div class="ad-slot">Advertisement · 728×90</div>
  <!-- AdSense: <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script> -->
</div>`;
  }
}

// ── SHARED CSS ────────────────────────────────────────────────────────────────
const SHARED_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --acc:#4F46E5;--acc-lt:#EEF2FF;--acc-dk:#3730A3;
  --txt:#0f172a;--muted:#64748b;--faint:#94a3b8;
  --surf:#ffffff;--surf2:#f8fafc;--bdr:#e2e8f0;
  --sh:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06);
  --sh-md:0 4px 16px rgba(0,0,0,.10);
  --sh-lg:0 20px 48px rgba(79,70,229,.15);
}
body{font-family:'Inter',sans-serif;color:var(--txt);background:var(--surf);line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--bdr);padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.nav-brand{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:800;color:var(--txt)}
.nav-logo{width:28px;height:28px;background:var(--acc);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0}
.nav-brand span{color:var(--acc)}
.nav-right{display:flex;align-items:center;gap:10px}
.nav-cta{background:var(--acc);color:#fff;padding:9px 22px;border-radius:8px;font-weight:700;font-size:14px;transition:background .15s;white-space:nowrap}
.nav-cta:hover{background:var(--acc-dk)}
.hero{padding:80px 24px 64px;text-align:center;background:linear-gradient(160deg,#f0f4ff 0%,#fff 60%)}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:var(--acc-lt);color:var(--acc);border:1px solid #c7d2fe;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:24px}
.hero h1{font-size:clamp(32px,6vw,58px);font-weight:900;line-height:1.1;letter-spacing:-1.5px;max-width:760px;margin:0 auto 20px;color:var(--txt)}
.hero h1 span{color:var(--acc)}
.hero p{font-size:clamp(15px,2.5vw,19px);color:var(--muted);max-width:600px;margin:0 auto 36px}
.hero-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn-primary{background:var(--acc);color:#fff;padding:14px 34px;border-radius:10px;font-size:16px;font-weight:700;display:inline-flex;align-items:center;gap:8px;transition:background .15s,transform .1s;box-shadow:var(--sh-lg)}
.btn-primary:hover{background:var(--acc-dk);transform:translateY(-1px)}
.btn-secondary{background:#fff;color:var(--txt);padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;border:1.5px solid var(--bdr);transition:border-color .15s,background .15s}
.btn-secondary:hover{border-color:var(--acc);background:var(--acc-lt)}
.hero-note{font-size:13px;color:var(--faint);margin-top:18px}
.hero-note strong{color:var(--muted)}
.ad-slot{width:100%;max-width:728px;margin:0 auto;min-height:90px;background:var(--surf2);border:1px dashed var(--bdr);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.section{padding:72px 24px;max-width:1100px;margin:0 auto}
.section-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--acc);margin-bottom:10px}
.section-title{font-size:clamp(24px,4vw,38px);font-weight:800;letter-spacing:-0.5px;max-width:600px;margin-bottom:14px}
.section-desc{font-size:16px;color:var(--muted);max-width:520px;margin-bottom:48px}
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}
.feat-card{background:var(--surf);border:1.5px solid var(--bdr);border-radius:14px;padding:24px;transition:box-shadow .2s,border-color .2s}
.feat-card:hover{box-shadow:var(--sh-md);border-color:#c7d2fe}
.feat-icon{font-size:28px;margin-bottom:14px}
.feat-title{font-size:16px;font-weight:700;margin-bottom:6px}
.feat-desc{font-size:14px;color:var(--muted);line-height:1.65}
.templates-section{background:var(--surf2);padding:72px 24px}
.templates-inner{max-width:1100px;margin:0 auto}
.templates-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:40px}
.tpl-thumb{background:#fff;border:1.5px solid var(--bdr);border-radius:12px;overflow:hidden;transition:box-shadow .2s,border-color .2s;cursor:pointer}
.tpl-thumb:hover{box-shadow:var(--sh-md);border-color:var(--acc)}
.tpl-thumb a{display:block}
.tpl-preview{height:160px;display:flex;flex-direction:column;gap:5px;padding:14px;background:linear-gradient(135deg,var(--acc-lt),#fff)}
.tpl-line{height:6px;border-radius:3px;background:var(--acc);opacity:.18}
.tpl-line.accent{background:var(--acc);opacity:.7;width:40%}
.tpl-line.short{width:60%}
.tpl-label{padding:10px 14px;font-size:13px;font-weight:600;border-top:1px solid var(--bdr)}
.prof-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.prof-chip{background:var(--acc-lt);color:var(--acc);padding:7px 16px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid #c7d2fe}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;margin-top:40px;counter-reset:step}
.step{position:relative;padding:24px;background:var(--surf);border:1.5px solid var(--bdr);border-radius:14px;counter-increment:step}
.step::before{content:counter(step);position:absolute;top:-14px;left:20px;width:28px;height:28px;background:var(--acc);color:#fff;border-radius:50%;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center}
.step-title{font-size:15px;font-weight:700;margin-bottom:6px}
.step-desc{font-size:14px;color:var(--muted)}
.privacy-band{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:56px 24px;text-align:center}
.privacy-band h2{font-size:28px;font-weight:800;margin-bottom:12px}
.privacy-band p{color:#94a3b8;max-width:540px;margin:0 auto 24px;font-size:15px}
.privacy-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:32px}
.p-chip{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);padding:7px 16px;border-radius:20px;font-size:13px;color:#e2e8f0}
.faq{max-width:720px;margin:0 auto}
.faq-item{border-bottom:1px solid var(--bdr);padding:20px 0}
.faq-q{font-size:15px;font-weight:700;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none}
.faq-q::after{content:'＋';font-size:18px;color:var(--acc);flex-shrink:0;margin-left:12px}
.faq-item.open .faq-q::after{content:'−'}
.faq-a{font-size:14px;color:var(--muted);line-height:1.7;max-height:0;overflow:hidden;transition:max-height .3s ease,padding .3s}
.faq-item.open .faq-a{max-height:300px;padding-top:10px}
footer{background:var(--surf2);border-top:1px solid var(--bdr);padding:32px 24px;text-align:center}
.footer-links{display:flex;gap:20px;justify-content:center;margin-bottom:14px;flex-wrap:wrap}
.footer-links a{font-size:14px;color:var(--muted);font-weight:500;transition:color .15s}
.footer-links a:hover{color:var(--acc)}
.footer-copy{font-size:13px;color:var(--faint)}
@media(max-width:640px){.hero{padding:56px 18px 48px}.section{padding:48px 18px}.templates-section{padding:48px 18px}nav{padding:0 14px}.nav-cta{padding:7px 14px;font-size:13px}}
`;

// ── INDEX.HTML GENERATOR ──────────────────────────────────────────────────────
function generateIndex(lang) {
  const t = LANGS[lang];
  const m = t.meta;
  const builderPath = '../../builder.html';

  const featureCards = t.features.items.map(f => `
    <div class="feat-card">
      <div class="feat-icon">${f.icon}</div>
      <div class="feat-title">${esc(f.title)}</div>
      <div class="feat-desc">${esc(f.desc)}</div>
    </div>`).join('');

  const profChips = t.professions.items.map(p =>
    `<span class="prof-chip">${esc(p)}</span>`).join('\n    ');

  const steps = t.howItWorks.steps.map(s => `
      <div class="step">
        <div class="step-title">${esc(s.title)}</div>
        <div class="step-desc">${esc(s.desc)}</div>
      </div>`).join('');

  const privacyChips = t.privacy.chips.map(c =>
    `<span class="p-chip">${esc(c)}</span>`).join('\n    ');

  const faqItems = t.faq.items.map(f => `
    <div class="faq-item">
      <div class="faq-q">${esc(f.q)}</div>
      <div class="faq-a">${esc(f.a)}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="${m.lang}" dir="${m.dir}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description)}"/>
<meta name="keywords" content="${esc(m.keywords)}"/>
<meta name="robots" content="index, follow"/>
<meta property="og:title" content="${esc(m.ogTitle)}"/>
<meta property="og:description" content="${esc(m.ogDesc)}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${SITE_URL}/${lang}/index.html"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(m.ogTitle)}"/>
<meta name="twitter:description" content="${esc(m.twitterDesc)}"/>
${canonicalTag(lang, 'index')}
${hreflangTags('index')}
${FAVICON}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<!-- Google AdSense — replace ca-pub-XXXXXXXXXXXXXXXX with your publisher ID -->
<!-- <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script> -->
<style>${SHARED_CSS}${LANG_SELECTOR_CSS}</style>
</head>
<body>

<nav>
  <a href="index.html" class="nav-brand">
    <div class="nav-logo">◈</div>
    Resume<span>Builder</span>
  </a>
  <div class="nav-right">
    ${langSelectorHTML(lang, 'index')}
    <a href="${builderPath}" class="nav-cta">${esc(t.nav.cta)}</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-badge">${esc(t.hero.badge)}</div>
  <h1>${esc(t.hero.h1a)}<span>${esc(t.hero.h1b)}</span>${esc(t.hero.h1c)}</h1>
  <p>${esc(t.hero.p)}</p>
  <div class="hero-btns">
    <a href="${builderPath}" class="btn-primary">${esc(t.hero.cta)}</a>
    <a href="#how-it-works" class="btn-secondary">${esc(t.hero.secondary)}</a>
  </div>
  <p class="hero-note">${t.hero.note}</p>
</section>

${adSlot('leaderboard')}

<div class="section">
  <div class="section-label">${esc(t.features.label)}</div>
  <h2 class="section-title">${esc(t.features.title)}</h2>
  <p class="section-desc">${esc(t.features.desc)}</p>
  <div class="features-grid">${featureCards}</div>
</div>

<div class="templates-section">
  <div class="templates-inner">
    <div class="section-label">${esc(t.templates.label)}</div>
    <h2 class="section-title">${esc(t.templates.title)}</h2>
    <p class="section-desc">${esc(t.templates.desc)}</p>
    <div class="templates-grid">
      <div class="tpl-thumb"><a href="${builderPath}">
        <div class="tpl-preview"><div class="tpl-line accent"></div><div class="tpl-line short"></div><div class="tpl-line"></div><div class="tpl-line short"></div><div class="tpl-line"></div><div class="tpl-line short"></div></div>
        <div class="tpl-label">Minimal</div>
      </a></div>
      <div class="tpl-thumb"><a href="${builderPath}">
        <div class="tpl-preview" style="background:linear-gradient(135deg,#e0e7ff,#fff)"><div class="tpl-line accent"></div><div class="tpl-line short"></div><div class="tpl-line"></div><div class="tpl-line short"></div><div class="tpl-line"></div></div>
        <div class="tpl-label">Modern</div>
      </a></div>
      <div class="tpl-thumb"><a href="${builderPath}">
        <div class="tpl-preview" style="background:linear-gradient(135deg,#1e293b,#334155);display:grid;grid-template-columns:38% 1fr;padding:0;gap:0"><div style="background:rgba(255,255,255,.06);padding:12px;display:flex;flex-direction:column;gap:5px"><div class="tpl-line" style="background:#fff;opacity:.3"></div><div class="tpl-line short" style="background:#fff;opacity:.15"></div></div><div style="padding:12px;display:flex;flex-direction:column;gap:5px"><div class="tpl-line"></div><div class="tpl-line short"></div><div class="tpl-line"></div></div></div>
        <div class="tpl-label">Two-Column</div>
      </a></div>
      <div class="tpl-thumb"><a href="${builderPath}">
        <div class="tpl-preview" style="background:linear-gradient(135deg,#faf5ff,#fff)"><div class="tpl-line accent" style="width:60%"></div><div class="tpl-line short"></div><div class="tpl-line"></div><div class="tpl-line short"></div></div>
        <div class="tpl-label">Creative</div>
      </a></div>
      <div class="tpl-thumb"><a href="${builderPath}">
        <div class="tpl-preview" style="background:#fff"><div class="tpl-line" style="background:#000;opacity:.7;width:50%"></div><div class="tpl-line short" style="background:#000;opacity:.3"></div><div style="border-top:1.5px solid #000;opacity:.2;margin:4px 0"></div><div class="tpl-line"></div><div class="tpl-line short"></div></div>
        <div class="tpl-label">ATS Professional</div>
      </a></div>
    </div>
    <div style="text-align:center;margin-top:28px">
      <a href="${builderPath}" class="btn-primary" style="display:inline-flex">${esc(t.templates.cta)}</a>
    </div>
  </div>
</div>

<div class="section" style="padding-top:56px;padding-bottom:56px">
  <div class="section-label">${esc(t.professions.label)}</div>
  <h2 class="section-title">${esc(t.professions.title)}</h2>
  <p class="section-desc">${esc(t.professions.desc)}</p>
  <div class="prof-grid">
    ${profChips}
  </div>
</div>

<div style="background:var(--surf2);padding:72px 0" id="how-it-works">
  <div class="section" style="padding-top:0;padding-bottom:0">
    <div class="section-label">${esc(t.howItWorks.label)}</div>
    <h2 class="section-title">${esc(t.howItWorks.title)}</h2>
    <div class="steps">${steps}</div>
  </div>
</div>

${adSlot('rectangle')}

<div class="privacy-band">
  <h2>${esc(t.privacy.title)}</h2>
  <p>${esc(t.privacy.desc)}</p>
  <div class="privacy-chips">
    ${privacyChips}
  </div>
  <a href="${builderPath}" class="btn-primary" style="background:#fff;color:#1e293b">${esc(t.privacy.cta)}</a>
</div>

<div class="section">
  <div class="section-label">${esc(t.faq.label)}</div>
  <h2 class="section-title" style="margin-bottom:36px">${esc(t.faq.title)}</h2>
  <div class="faq">${faqItems}</div>
</div>

${adSlot('footer')}

<footer>
  <div class="footer-links">
    <a href="${builderPath}">${esc(t.footer.builder)}</a>
    <a href="privacy-policy.html">${esc(t.footer.privacy)}</a>
    <a href="#how-it-works">${esc(t.footer.howItWorks)}</a>
  </div>
  <div class="footer-copy">${esc(t.footer.copy)}</div>
</footer>

<script>
${LANG_SELECTOR_JS}
document.querySelectorAll('.faq-item').forEach(function(item){
  item.querySelector('.faq-q').addEventListener('click',function(){
    var isOpen=item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(function(i){i.classList.remove('open');});
    if(!isOpen)item.classList.add('open');
  });
});
</script>
</body>
</html>`;
}

// ── PRIVACY POLICY GENERATOR ──────────────────────────────────────────────────
// Privacy policy is a legal document — only English is fully translated.
// Other languages show a translated heading + "This policy is available in English" note,
// then the full English text. This is intentional: legal documents should not be
// machine-translated. Add native translations to this function as needed.
function generatePrivacy(lang) {
  const t = LANGS[lang];
  const builderPath = '../../builder.html';
  const privacyTitle = {
    en: 'Privacy Policy',
    fr: 'Politique de Confidentialité',
    es: 'Política de Privacidad',
    pt: 'Política de Privacidade',
    de: 'Datenschutzerklärung',
  };
  const privacyNote = {
    en: null,
    fr: 'Cette politique de confidentialité est disponible en anglais ci-dessous. Une traduction officielle sera ajoutée prochainement.',
    es: 'Esta política de privacidad está disponible en inglés a continuación. Próximamente se añadirá una traducción oficial.',
    pt: 'Esta política de privacidade está disponível em inglês abaixo. Uma tradução oficial será adicionada em breve.',
    de: 'Diese Datenschutzerklärung ist unten auf Englisch verfügbar. Eine offizielle Übersetzung wird in Kürze hinzugefügt.',
  };

  const noteBlock = privacyNote[lang]
    ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:28px;font-size:14px;color:#92400e">${esc(privacyNote[lang])}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="${t.meta.lang}" dir="${t.meta.dir}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(privacyTitle[lang])} — ResumeBuilder</title>
<meta name="description" content="ResumeBuilder privacy policy. Your resume data never leaves your browser. No accounts, no tracking, no data collection."/>
<meta name="robots" content="index, follow"/>
${canonicalTag(lang, 'privacy')}
${hreflangTags('privacy')}
${FAVICON}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
${SHARED_CSS}${LANG_SELECTOR_CSS}
.content{max-width:720px;margin:0 auto;padding:56px 24px 80px}
h1{font-size:32px;font-weight:800;letter-spacing:-0.5px;margin-bottom:8px}
.updated{font-size:13px;color:var(--muted);margin-bottom:40px}
h2{font-size:18px;font-weight:700;margin:36px 0 10px}
p{font-size:15px;color:#334155;margin-bottom:14px}
ul{padding-left:20px;margin-bottom:14px}
li{font-size:15px;color:#334155;margin-bottom:6px;line-height:1.65}
.highlight{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin:24px 0;font-size:15px;color:#1e40af;font-weight:500}
a{color:var(--acc)}
</style>
</head>
<body>
<nav>
  <a href="index.html" class="nav-brand">
    <div class="nav-logo">◈</div>
    Resume<span>Builder</span>
  </a>
  <div class="nav-right">
    ${langSelectorHTML(lang, 'privacy')}
    <a href="${builderPath}" class="nav-cta">${esc(t.nav.cta)}</a>
  </div>
</nav>
<div class="content">
  <h1>${esc(privacyTitle[lang])}</h1>
  <p class="updated">Last updated: January 2025</p>
  ${noteBlock}
  <div class="highlight">🔒 The short version: ResumeBuilder does not collect, store, or transmit any of your personal data. Your resume stays on your device.</div>
  <h2>1. Overview</h2>
  <p>ResumeBuilder ("we", "our", or "the service") is a free, browser-based resume builder. This Privacy Policy explains how we handle your information when you use our website and builder tool.</p>
  <p>We are committed to your privacy. Our builder is designed from the ground up to store your data locally on your own device — not on our servers.</p>
  <h2>2. Information We Do Not Collect</h2>
  <p>The resume builder tool does not collect, transmit, or store any of the following on our servers:</p>
  <ul>
    <li>Your name, email address, or any personal contact information</li>
    <li>Your work history, education, or skills</li>
    <li>Your profile photo or any uploaded images</li>
    <li>Your resume content in any form</li>
  </ul>
  <p>All resume data you enter is saved exclusively in your browser's <strong>localStorage</strong> — a storage mechanism built into your browser that never sends data to any external server.</p>
  <h2>3. Local Storage</h2>
  <p>ResumeBuilder uses your browser's localStorage to automatically save your resume data between sessions. This data exists only on your device, is never transmitted to our servers, can be cleared at any time by clearing your browser data, and is not accessible to us or any third party.</p>
  <h2>4. Google AdSense</h2>
  <p>Our landing page displays advertisements served by Google AdSense. Google may use cookies to serve relevant ads. This is separate from the resume builder itself. The builder does not display advertisements and does not load any Google AdSense scripts. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a> for details.</p>
  <h2>5. Analytics</h2>
  <p>We may use privacy-respecting analytics (such as Cloudflare Web Analytics) to understand basic traffic patterns. This data is aggregated and does not include personally identifiable information. No analytics scripts are loaded inside the resume builder tool.</p>
  <h2>6. Cookies</h2>
  <p>The resume builder does not use cookies. The landing page may receive cookies from Google AdSense. You can manage cookie preferences through your browser settings.</p>
  <h2>7. Third-Party Services</h2>
  <p>ResumeBuilder is hosted on Cloudflare Pages. Cloudflare may collect basic server-level logs as part of standard hosting infrastructure. See <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">Cloudflare's Privacy Policy</a>. We use Google Fonts for typography on the landing page. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</p>
  <h2>8. Children's Privacy</h2>
  <p>ResumeBuilder is intended for adults. We do not knowingly collect any information from children under 13.</p>
  <h2>9. Your Rights</h2>
  <p>Because we do not collect your personal data, there is nothing for us to delete, correct, or export on your behalf. To remove your resume data, clear your browser's localStorage or use the "Clear" button in the builder.</p>
  <h2>10. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date.</p>
  <h2>11. Contact</h2>
  <p>If you have any questions about this Privacy Policy, please reach out via the contact information on our website.</p>
</div>
<footer>
  <div class="footer-links">
    <a href="index.html">${esc(t.footer.builder)}</a>
    <a href="../../builder.html">${esc(t.footer.builder)}</a>
    <a href="privacy-policy.html">${esc(t.footer.privacy)}</a>
  </div>
  <div class="footer-copy">${esc(t.footer.copy)}</div>
</footer>
<script>${LANG_SELECTOR_JS}</script>
</body>
</html>`;
}

// ── ROOT INDEX.HTML (browser-language redirect) ───────────────────────────────
function generateRootIndex() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ResumeBuilder — Free Professional Resume Builder</title>
<meta name="robots" content="noindex"/>
<link rel="canonical" href="${SITE_URL}/en/index.html"/>
${hreflangTags('index')}
${FAVICON}
<script>
// Browser-language detection with fallback to English.
// All language URLs remain directly accessible — no IP-based redirect.
(function(){
  var saved=localStorage.getItem('rb1_lang');
  var supported=['en','fr','es','pt','de'];
  var lang=saved&&supported.includes(saved)?saved:null;
  if(!lang){
    var nav=(navigator.language||navigator.userLanguage||'en').toLowerCase().slice(0,2);
    lang=supported.includes(nav)?nav:'en';
  }
  window.location.replace('/'+lang+'/index.html');
})();
</script>
</head>
<body>
<p>Redirecting… <a href="/en/index.html">Click here if not redirected.</a></p>
</body>
</html>`;
}

// ── SITEMAP ───────────────────────────────────────────────────────────────────
function generateSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const pages = ['index.html', 'privacy-policy.html'];
  const urls = [];

  // Root (redirect page — excluded, noindex)
  // Language pages
  for (const lang of SUPPORTED) {
    for (const page of pages) {
      urls.push(`
  <url>
    <loc>${SITE_URL}/${lang}/${page}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page === 'index.html' ? 'monthly' : 'yearly'}</changefreq>
    <priority>${page === 'index.html' ? (lang === 'en' ? '1.0' : '0.8') : '0.3'}</priority>
    ${SUPPORTED.map(l => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/${page}"/>`).join('\n    ')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/en/${page}"/>
  </url>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('')}
</urlset>`;
}

// ── ROBOTS.TXT ────────────────────────────────────────────────────────────────
function generateRobots() {
  return `User-agent: *
Allow: /

# Language directories — all indexable
${SUPPORTED.map(l => `Allow: /${l}/`).join('\n')}

# Builder app (shared, not localized per-language)
Allow: /builder.html

# Sitemap
Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// ── CLOUDFLARE _REDIRECTS ─────────────────────────────────────────────────────
// Cloudflare Pages uses _redirects for URL rules
function generateRedirects() {
  return `# ResumeBuilder — Cloudflare Pages _redirects
# Root → language detection page (serves root/index.html which redirects via JS)
# Direct language URLs are always accessible

# Legacy root URLs — redirect to English
/index.html         /en/index.html      301
/privacy-policy.html /en/privacy-policy.html 301

# Ensure /en, /fr etc. without trailing slash redirect to index
/en                 /en/index.html      301
/fr                 /fr/index.html      301
/es                 /es/index.html      301
/pt                 /pt/index.html      301
/de                 /de/index.html      301
`;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
console.log('🌐 ResumeBuilder — Multilingual Generator');
console.log('==========================================');

// Generate per-language pages
for (const lang of SUPPORTED) {
  const dir = path.join(ROOT, lang);
  fs.mkdirSync(dir, { recursive: true });

  const indexHtml = generateIndex(lang);
  fs.writeFileSync(path.join(dir, 'index.html'), indexHtml, 'utf8');
  console.log(`✅ /${lang}/index.html`);

  const privacyHtml = generatePrivacy(lang);
  fs.writeFileSync(path.join(dir, 'privacy-policy.html'), privacyHtml, 'utf8');
  console.log(`✅ /${lang}/privacy-policy.html`);
}

// Root index (language detector)
fs.writeFileSync(path.join(ROOT, 'index.html'), generateRootIndex(), 'utf8');
console.log('✅ /index.html (language detector)');

// Sitemap
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), generateSitemap(), 'utf8');
console.log('✅ /sitemap.xml');

// Robots
fs.writeFileSync(path.join(ROOT, 'robots.txt'), generateRobots(), 'utf8');
console.log('✅ /robots.txt');

// Cloudflare redirects
fs.writeFileSync(path.join(ROOT, '_redirects'), generateRedirects(), 'utf8');
console.log('✅ /_redirects');

console.log('\n✨ Done! All files generated.');
console.log(`📁 Structure:\n  /index.html (root detector)\n${SUPPORTED.map(l=>`  /${l}/index.html\n  /${l}/privacy-policy.html`).join('\n')}\n  /sitemap.xml\n  /robots.txt\n  /_redirects`);
