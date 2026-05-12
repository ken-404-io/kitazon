import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import KycGate from '../components/KycGate';
import api from '../services/api';
import styles from './MathQuiz.module.css';

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

/* ── Adsterra ad break component ─────────────────────────────────────────── */
function AdBreak({ onDone }: { onDone: () => void }) {
  const [secs, setSecs] = useState(AD_SECONDS);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    // atOptions config script
    const cfg = document.createElement('script');
    cfg.type = 'text/javascript';
    cfg.text = `atOptions = { 'key': '00611793b43988f6f1c486423ed8b687', 'format': 'iframe', 'height': 250, 'width': 300, 'params': {} };`;
    containerRef.current.appendChild(cfg);

    // invoke script
    const invoke = document.createElement('script');
    invoke.type = 'text/javascript';
    invoke.src = 'https://www.highperformanceformat.com/00611793b43988f6f1c486423ed8b687/invoke.js';
    containerRef.current.appendChild(invoke);
  }, []);

  useEffect(() => {
    if (secs <= 0) { onDone(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onDone]);

  return (
    <div className={styles.adBreak}>
      <p className={styles.adLabel}>Ad — next question in {secs}s</p>
      <div ref={containerRef} className={styles.adContainer} />
      <button className={styles.skipBtn} onClick={onDone} disabled={secs > 0}>
        {secs > 0 ? `Skip in ${secs}s` : 'Continue →'}
      </button>
    </div>
  );
}

/* ── Main quiz component ─────────────────────────────────────────────────── */
function QuizInner() {
  const navigate = useNavigate();
  const [question,   setQuestion]   = useState<Question>(makeQuestion);
  const [qNum,       setQNum]       = useState(1);
  const [selected,   setSelected]   = useState<number | null>(null);
  const [correct,    setCorrect]    = useState(0);
  const [earned,     setEarned]     = useState(0);
  const [capped,     setCapped]     = useState(false);
  const [phase,      setPhase]      = useState<'question' | 'ad' | 'result'>('question');

  const handleAnswer = useCallback(async (choice: number) => {
    if (selected !== null) return;
    setSelected(choice);
    const isCorrect = choice === question.answer;
    if (isCorrect) {
      setCorrect(c => c + 1);
      if (!capped) {
        try {
          const r = await api.post<{ amount: number; capped: boolean }>('/tasks/quiz/correct', {});
          setEarned(e => e + r.data.amount);
          if (r.data.capped) setCapped(true);
        } catch { /* already capped or rate limited */ }
      }
    }
    // Brief pause so user sees result, then show ad
    setTimeout(() => {
      if (qNum >= QUESTIONS_PER_ROUND) {
        setPhase('result');
      } else {
        setPhase('ad');
      }
    }, 900);
  }, [selected, question.answer, capped, qNum]);

  const nextQuestion = useCallback(() => {
    setQuestion(makeQuestion());
    setQNum(n => n + 1);
    setSelected(null);
    setPhase('question');
  }, []);

  const playAgain = () => {
    setQuestion(makeQuestion());
    setQNum(1);
    setSelected(null);
    setCorrect(0);
    setEarned(0);
    setCapped(false);
    setPhase('question');
  };

  if (phase === 'ad') return <AdBreak onDone={nextQuestion} />;

  if (phase === 'result') {
    return (
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
    );
  }

  return (
    <div className={styles.quiz}>
      {/* Progress */}
      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${((qNum - 1) / QUESTIONS_PER_ROUND) * 100}%` }} />
        </div>
        <span className={styles.progressLabel}>{qNum} / {QUESTIONS_PER_ROUND}</span>
      </div>

      {/* Earnings so far */}
      <div className={styles.earningsBadge}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ₱{earned.toFixed(2)} earned
      </div>

      {/* Question */}
      <div className={styles.questionCard}>
        <p className={styles.questionLabel}>What is</p>
        <p className={styles.questionText}>{question.text} = ?</p>
      </div>

      {/* Choices */}
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
  );
}

export default function MathQuiz() {
  return (
    <KycGate feature="tasks">
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.headerIcon}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div>
              <h1 className={styles.title}>Math Quiz</h1>
              <p className={styles.subtitle}>₱0.50 per correct answer · Max ₱10/day</p>
            </div>
          </div>
          <QuizInner />
        </div>
      </div>
    </KycGate>
  );
}
