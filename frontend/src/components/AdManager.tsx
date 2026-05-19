import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdManager() {
  const { user } = useAuth();

  const isPaidPlan = user?.plan && user.plan !== 'free';

  useEffect(() => {
    if (!user || user.is_admin || isPaidPlan) return;

    const scripts: HTMLScriptElement[] = [];

    const addScript = (attrs: Record<string, string>, inline?: string) => {
      const s = document.createElement('script');
      Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
      if (inline) s.textContent = inline;
      document.body.appendChild(s);
      scripts.push(s);
    };

    // Monetag Zone 11012417
    addScript(
      {},
      `(function(s){s.dataset.zone='11012417',s.src='https://ueuee.com/tag.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`
    );

    // Adsterra Social Bar
    addScript({ src: 'https://pl29417357.profitablecpmratenetwork.com/f8/8b/4a/f88b4accd723fbbe625cbc01ce5fcea6.js' });

    // Adsterra Native Banner
    addScript({ src: 'https://pl29417356.profitablecpmratenetwork.com/6eabcdaeb07c57f4f19da67d49052315/invoke.js', async: '', 'data-cfasync': 'false' });

    return () => { scripts.forEach(s => s.remove()); };
  }, [user]);

  return null;
}
