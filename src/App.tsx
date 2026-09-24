import { useState } from 'react';
import { decodeHtml, fetchQuestion, type TriviaQuestion } from './api';

export default function App() {
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGetQuestion() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      setQuestion(await fetchQuestion());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load a question.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card" aria-labelledby="title">
        <p className="eyebrow">React + TypeScript · Open Trivia DB</p>
        <h1 id="title">One question. Something new.</h1>
        <p className="intro">A tiny trivia break, one click at a time.</p>

        <button type="button" onClick={handleGetQuestion} disabled={loading}>
          {loading ? 'Loading…' : 'Get a trivia question'}
        </button>

        {error && <p className="error" role="alert">{error}</p>}
        <div aria-live="polite" aria-busy={loading}>
          {question ? (
            <article className="question">
              <p className="metadata">
                {decodeHtml(question.category)} · {question.difficulty}
              </p>
              <h2>{decodeHtml(question.question)}</h2>
              <details key={question.question}>
                <summary>Show answer</summary>
                <p>{decodeHtml(question.correct_answer)}</p>
              </details>
            </article>
          ) : (
            <p className="empty">Click the button to get a trivia question!</p>
          )}
        </div>
        <p className="hint">The API allows one request per IP every 5 seconds.</p>
        <a className="source" href="https://opentdb.com/" target="_blank" rel="noreferrer">
          Questions: Open Trivia DB · CC BY-SA 4.0
        </a>
      </section>
    </main>
  );
}

