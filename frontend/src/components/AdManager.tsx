import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Known ad-network domains / containers injected by the loaded SDKs.
const AD_SELECTOR =
  'script[data-zone], iframe[data-zone], ' +
  'script[src*="ueuee.com"], script[src*="dd133.com"], script[src*="quge5.com"], ' +
  'script[src*="profitablecpmratenetwork.com"], ' +
  'iframe[src*="ueuee.com"], iframe[src*="dd133.com"], iframe[src*="quge5.com"], ' +
  'iframe[src*="profitablecpmratenetwork.com"], ' +
  '[id*="container-6eabcdaeb07c57f4f19da67d49052315"]';

// All our own UI renders inside #root, so anything appended directly to <body>
// (other than the React root / stylesheets) is foreign and safe to strip.
function sweepAds(): void {
  document.querySelectorAll<HTMLElement>(AD_SELECTOR).forEach((el) => {
    if (el.tagName === 'IFRAME') {
      // Remove the full-screen wrapper the SDK appended to <body>, not just the iframe.
      let top: HTMLElement = el;
      while (top.parentElement && top.parentElement !== document.body) top = top.parentElement;
      if (top.parentElement === document.body && top.id !== 'root') { top.remove(); return; }
    }
    el.remove();
  });

  // Generic catch for interstitial / vignette overlays: a very high z-index,
  // fixed/absolute element appended straight to <body> that wraps an iframe.
  Array.from(document.body.children).forEach((node) => {
    const el = node as HTMLElement;
    if (el.id === 'root' || ['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'].includes(el.tagName)) return;
    const cs = getComputedStyle(el);
    const z = parseInt(cs.zIndex || '0', 10);
    if ((cs.position === 'fixed' || cs.position === 'absolute') && z >= 1_000_000 && el.querySelector('iframe')) {
      el.remove();
    }
  });
}

export default function AdManager() {
  const { user } = useAuth();
  const location = useLocation();

  const isPaidPlan = user?.plan && user.plan !== 'free';
  // Suppress ads on the Plans page so free users can avail a plan without distraction.
  const onPlansPage = location.pathname === '/plans';

  useEffect(() => {
    const suppress = !user || user.is_admin || isPaidPlan || onPlansPage;

    if (suppress) {
      sweepAds();
      // On the Plans page the ad SDKs are still alive in memory from previous
      // pages and keep self-injecting elements, so keep sweeping while we're here.
      if (onPlansPage) {
        let raf = 0;
        const observer = new MutationObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(sweepAds);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        return () => { observer.disconnect(); cancelAnimationFrame(raf); };
      }
      return;
    }

    const scripts: HTMLScriptElement[] = [];

    const addScript = (attrs: Record<string, string>, inline?: string) => {
      const s = document.createElement('script');
      Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
      if (inline) s.textContent = inline;
      document.body.appendChild(s);
      scripts.push(s);
    };

    // Monetag Zone 11012417 — direct tracked script (not inline injector so cleanup works)
    addScript({ src: 'https://ueuee.com/tag.min.js', 'data-zone': '11012417', async: '' });

    // Monetag Zone 11042162 (vignette)
    addScript({ src: 'https://dd133.com/vignette.min.js', 'data-zone': '11042162', async: '' });

    // Monetag Zone 11042455
    addScript({ src: 'https://ueuee.com/tag.min.js', 'data-zone': '11042455', async: '' });

    // Monetag Zone 240267 — disabled
    // addScript({ src: 'https://quge5.com/88/tag.min.js', 'data-zone': '240267', async: '', 'data-cfasync': 'false' });

    // Adsterra Social Bar
    addScript({ src: 'https://pl29417357.profitablecpmratenetwork.com/f8/8b/4a/f88b4accd723fbbe625cbc01ce5fcea6.js' });

    // Adsterra Native Banner
    addScript({ src: 'https://pl29417356.profitablecpmratenetwork.com/6eabcdaeb07c57f4f19da67d49052315/invoke.js', async: '', 'data-cfasync': 'false' });

    return () => {
      scripts.forEach(s => s.remove());
      sweepAds();
    };
  }, [user, isPaidPlan, onPlansPage]);

  return null;
}
