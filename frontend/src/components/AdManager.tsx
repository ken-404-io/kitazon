import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdManager() {
  const { user } = useAuth();
  const location = useLocation();

  const isPaidPlan = user?.plan && user.plan !== 'free';
  // Suppress ads on the Plans page so free users can avail a plan without distraction.
  const onPlansPage = location.pathname === '/plans';

  useEffect(() => {
    if (!user || user.is_admin || isPaidPlan || onPlansPage) {
      // Remove any lingering ad scripts/iframes left from a previous free-plan session
      document
        .querySelectorAll<HTMLElement>(
          'script[data-zone], script[src*="ueuee.com"], script[src*="dd133.com"], script[src*="quge5.com"], ' +
          'script[src*="profitablecpmratenetwork.com"], ' +
          'iframe[src*="ueuee.com"], iframe[src*="dd133.com"], iframe[src*="profitablecpmratenetwork.com"], ' +
          '[id*="container-6eabcdaeb07c57f4f19da67d49052315"]'
        )
        .forEach(el => el.remove());
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

    // Monetag Zone 240267
    addScript({ src: 'https://quge5.com/88/tag.min.js', 'data-zone': '240267', async: '', 'data-cfasync': 'false' });

    // Adsterra Social Bar
    addScript({ src: 'https://pl29417357.profitablecpmratenetwork.com/f8/8b/4a/f88b4accd723fbbe625cbc01ce5fcea6.js' });

    // Adsterra Native Banner
    addScript({ src: 'https://pl29417356.profitablecpmratenetwork.com/6eabcdaeb07c57f4f19da67d49052315/invoke.js', async: '', 'data-cfasync': 'false' });

    return () => {
      scripts.forEach(s => s.remove());
      // Also sweep any iframes/elements injected by the ad SDKs themselves
      document
        .querySelectorAll<HTMLElement>(
          'script[data-zone], script[src*="ueuee.com"], script[src*="dd133.com"], script[src*="quge5.com"], ' +
          'iframe[src*="ueuee.com"], iframe[src*="dd133.com"], iframe[src*="quge5.com"], iframe[src*="profitablecpmratenetwork.com"], ' +
          '[id*="container-6eabcdaeb07c57f4f19da67d49052315"]'
        )
        .forEach(el => el.remove());
    };
  }, [user, isPaidPlan, onPlansPage]);

  return null;
}
