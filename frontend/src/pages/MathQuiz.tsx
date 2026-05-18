import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import KycGate from '../components/KycGate';
import api from '../services/api';
import styles from './MathQuiz.module.css';

const PLAN_LIMITS: Record<string, string> = {
  free:    '₱150/day',
  bronze:  '₱150/day',
  silver:  '₱500/day',
  gold:    '₱2,000/day',
  diamond: '₱4,000/day',
};

const QUESTIONS_PER_ROUND = 10;
const AD_SECONDS = 5;

type Op = '+' | '−' | '×' | '÷';

interface Question {
  text: string;
  answer: number;
  choices: number[];
}

function makeQuestion(): Question {
  const ops: Op[] = ['+', '−', '×', '÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;

  if (op === '+') {
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    answer = a + b;
  } else if (op === '−') {
    a = Math.floor(Math.random() * 50) + 10;
    b = Math.floor(Math.random() * a) + 1;
    answer = a - b;
  } else if (op === '×') {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
    answer = a * b;
  } else {
    b = Math.floor(Math.random() * 11) + 2;
    answer = Math.floor(Math.random() * 10) + 1;
    a = b * answer;
  }

  const wrongSet = new Set<number>([answer]);
  while (wrongSet.size < 4) {
    const delta = Math.floor(Math.random() * 10) + 1;
    wrongSet.add(answer + (Math.random() < 0.5 ? delta : -delta));
  }
  const choices = Array.from(wrongSet).sort(() => Math.random() - 0.5);
  return { text: `${a} ${op} ${b}`, answer, choices };
}

/* ── Leave confirmation modal ─────────────────────────────────────────────── */
function LeaveConfirmModal({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div className={styles.leaveOverlay}>
      <div className={styles.leaveModal}>
        <div className={styles.leaveWarningIcon}>⚠️</div>
        <h3 className={styles.leaveTitle}>Leave Quiz?</h3>
        <p className={styles.leaveBody}>
          Your reward for this question will <strong>not be counted</strong> if you leave during the ad.
        </p>
        <div className={styles.leaveBtns}>
          <button className={styles.stayBtn} onClick={onStay}>Stay &amp; Watch</button>
          <button className={styles.leaveBtn} onClick={onLeave}>Leave Anyway</button>
        </div>
      </div>
    </div>
  );
}

/* ── Adsterra ad break component ─────────────────────────────────────────── */
function AdBreak({ onDone, onAbandoned }: { onDone: () => void; onAbandoned: () => void }) {
  const [secs, setSecs]       = useState(AD_SECONDS);
  const [adReady, setAdReady] = useState(false);
  const containerRef  = useRef<HTMLDivElement>(null);
  const doneCalledRef = useRef(false);
  const onDoneRef     = useRef(onDone);
  const onAbandonedRef = useRef(onAbandoned);
  onDoneRef.current     = onDone;
  onAbandonedRef.current = onAbandoned;

  const skip = useCallback(() => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    onDoneRef.current();
  }, []);

  // If component unmounts before ad finishes → user navigated away → forfeit reward
  useEffect(() => {
    return () => {
      if (!doneCalledRef.current) onAbandonedRef.current();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const fallback = setTimeout(skip, 4000);

    const observer = new MutationObserver(() => {
      if (containerRef.current?.querySelector('iframe')) {
        observer.disconnect();
        clearTimeout(fallback);
        setAdReady(true);
      }
    });
    observer.observe(containerRef.current, { childList: true, subtree: true });

    const cfg = document.createElement('script');
    cfg.type = 'text/javascript';
    cfg.text = `atOptions = { 'key': '00611793b43988f6f1c486423ed8b687', 'format': 'iframe', 'height': 250, 'width': 300, 'params': {} };`;
    containerRef.current.appendChild(cfg);

    const invoke = document.createElement('script');
    invoke.type = 'text/javascript';
    invoke.src = 'https://www.highperformanceformat.com/00611793b43988f6f1c486423ed8b687/invoke.js';
    invoke.onerror = () => { observer.disconnect(); clearTimeout(fallback); skip(); };
    containerRef.current.appendChild(invoke);

    return () => { clearTimeout(fallback); observer.disconnect(); };
  }, [skip]);

  useEffect(() => {
    if (!adReady) return;
    if (secs <= 0) { skip(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, adReady, skip]);

  return (
    <div className={styles.adBreak}>
      <p className={styles.adLabel}>
        {adReady ? `AD — next question in ${secs}s` : 'Loading…'}
      </p>
      <div ref={containerRef} className={styles.adContainer} />
      <button className={styles.skipBtn} onClick={skip} disabled={adReady && secs > 0}>
        {!adReady ? 'Loading…' : secs > 0 ? `Skip in ${secs}s` : 'Continue →'}
      </button>
    </div>
  );
}

/* ── Main quiz component ─────────────────────────────────────────────────── */
function QuizInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const noAds = !!(user?.plan && user.plan !== 'free');

  const [question,      setQuestion]      = useState<Question>(makeQuestion);
  const [qNum,          setQNum]          = useState(1);
  const [selected,      setSelected]      = useState<number | null>(null);
  const [correct,       setCorrect]       = useState(0);
  const [earned,        setEarned]        = useState(0);
  const [capped,        setCapped]        = useState(false);
  const [phase,         setPhase]         = useState<'question' | 'ad' | 'result'>('question');
  const [pendingReward, setPendingReward] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const isAdPhase = phase === 'ad';
  const pendingRewardRef = useRef(pendingReward);
  pendingRewardRef.current = pendingReward;

  // ── Back-button guard (popstate) ──────────────────────────────────────────
  useEffect(() => {
    if (!isAdPhase) return;
    // Push a duplicate state so the back button triggers popstate instead of leaving
    window.history.pushState(null, '', window.location.href);
    const handler = () => {
      // Re-push so another press doesn't leave without prompting again
      window.history.pushState(null, '', window.location.href);
      setShowLeaveModal(true);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isAdPhase]);

  // ── Browser close / refresh guard ────────────────────────────────────────
  useEffect(() => {
    if (!isAdPhase) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAdPhase]);

  // ── Credit reward (only called after ad finishes) ─────────────────────────
  const creditReward = useCallback(async () => {
    if (!pendingRewardRef.current || capped) { setPendingReward(false); return; }
    setPendingReward(false);
    try {
      const r = await api.post<{ amount: number; capped: boolean }>('/tasks/quiz/correct', {});
      setEarned(e => e + r.data.amount);
      if (r.data.capped) setCapped(true);
    } catch { /* capped or rate-limited */ }
  }, [capped]);

  const handleAnswer = useCallback(async (choice: number) => {
    if (selected !== null) return;
    setSelected(choice);
    const isCorrect = choice === question.answer;

    if (isCorrect) {
      setCorrect(c => c + 1);
      if (qNum >= QUESTIONS_PER_ROUND || noAds) {
        // Last question OR paid plan — credit immediately, no ad
        if (!capped) {
          try {
            const r = await api.post<{ amount: number; capped: boolean }>('/tasks/quiz/correct', {});
            setEarned(e => e + r.data.amount);
            if (r.data.capped) setCapped(true);
          } catch {}
        }
      } else {
        // Free plan: defer reward until after ad completes
        setPendingReward(true);
      }
    }

    setTimeout(() => {
      if (qNum >= QUESTIONS_PER_ROUND) setPhase('result');
      else if (noAds) { setQuestion(makeQuestion()); setQNum(n => n + 1); setSelected(null); setPhase('question'); }
      else setPhase('ad');
    }, 900);
  }, [selected, question.answer, capped, qNum]);

  const nextQuestion = useCallback(() => {
    creditReward();
    setQuestion(makeQuestion());
    setQNum(n => n + 1);
    setSelected(null);
    setPhase('question');
  }, [creditReward]);

  // Ad unmounted without completing → user navigated away → forfeit
  const handleAbandoned = useCallback(() => {
    setPendingReward(false);
  }, []);

  const handleStay = () => setShowLeaveModal(false);

  const handleLeave = () => {
    setPendingReward(false);
    setShowLeaveModal(false);
    navigate(-1); // go back now that we've cleared the reward
  };

  const playAgain = () => {
    setPendingReward(false);
    setQuestion(makeQuestion());
    setQNum(1);
    setSelected(null);
    setCorrect(0);
    setEarned(0);
    setCapped(false);
    setPhase('question');
  };

  return (
    <>
      {showLeaveModal && <LeaveConfirmModal onStay={handleStay} onLeave={handleLeave} />}

      {/* Transparent overlay during ad phase — intercepts any click outside the ad area */}
      {isAdPhase && !showLeaveModal && (
        <div className={styles.navIntercept} onClick={() => setShowLeaveModal(true)} />
      )}

      {phase === 'ad' && (
        <AdBreak onDone={nextQuestion} onAbandoned={handleAbandoned} />
      )}

      {phase === 'result' && (
        <div className={styles.result}>
          <div className={styles.resultIcon}>
            {correct >= 7
              ? <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            }
          </div>
          <h2 className={styles.resultTitle}>Round Complete!</h2>
          <p className={styles.resultScore}>{correct} / {QUESTIONS_PER_ROUND} correct</p>
          <p className={styles.resultEarned}>+₱{earned.toFixed(2)} earned</p>
          {capped && <p className={styles.cappedNote}>Daily limit reached — come back tomorrow for more!</p>}
          <div className={styles.resultBtns}>
            <button className={styles.playAgainBtn} onClick={playAgain}>Play Again</button>
            <button className={styles.dashBtn} onClick={() => navigate('/dashboard')}>Dashboard</button>
          </div>
        </div>
      )}

      {phase === 'question' && (
        <div className={styles.quiz}>
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${((qNum - 1) / QUESTIONS_PER_ROUND) * 100}%` }} />
            </div>
            <span className={styles.progressLabel}>{qNum} / {QUESTIONS_PER_ROUND}</span>
          </div>

          <div className={styles.earningsBadge}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ₱{earned.toFixed(2)} earned
          </div>

          <div className={styles.questionCard}>
            <p className={styles.questionLabel}>What is</p>
            <p className={styles.questionText}>{question.text} = ?</p>
          </div>

          <div className={styles.choices}>
            {question.choices.map(c => {
              let cls = styles.choice;
              if (selected !== null) {
                if (c === question.answer) cls = `${styles.choice} ${styles.choiceCorrect}`;
                else if (c === selected)  cls = `${styles.choice} ${styles.choiceWrong}`;
                else                      cls = `${styles.choice} ${styles.choiceDim}`;
              }
              return (
                <button key={c} className={cls} onClick={() => handleAnswer(c)} disabled={selected !== null}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default function MathQuiz() {
  const { user } = useAuth();
  const plan = (user as { plan?: string })?.plan ?? 'free';
  const limitLabel = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  return (
    <KycGate feature="tasks">
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.headerIcon}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <div>
              <h1 className={styles.title}>Math Quiz</h1>
              <p className={styles.subtitle}>₱3.00 per correct answer · Max {limitLabel}</p>
            </div>
          </div>
          <QuizInner />
        </div>
      </div>
    </KycGate>
  );
}
