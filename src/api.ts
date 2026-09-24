export const TRIVIA_URL = 'https://opentdb.com/api.php?amount=1';
export const RATE_LIMIT_MESSAGE = 'Please try again in a moment.';

export interface TriviaQuestion {
  question: string;
  category: string;
  difficulty: string;
  correct_answer: string;
}

function isQuestion(value: unknown): value is TriviaQuestion {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return ['question', 'category', 'difficulty', 'correct_answer']
    .every((key) => typeof item[key] === 'string');
}

export function decodeHtml(value: string): string {
  // Detached textarea decodes entities. The result is rendered as text, not HTML.
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

export async function fetchQuestion(): Promise<TriviaQuestion> {
  const response = await fetch(TRIVIA_URL, {
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 429) throw new Error(RATE_LIMIT_MESSAGE);
  if (!response.ok) throw new Error(`Request failed (HTTP ${response.status}).`);

  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('The API returned an invalid response.');
  }

  const data = payload as Record<string, unknown>;
  // Open Trivia DB can also report its rate limit inside a HTTP 200 body.
  if (data.response_code === 5) throw new Error(RATE_LIMIT_MESSAGE);
  if (data.response_code !== 0) {
    throw new Error('No question is available. Please try again later.');
  }
  if (!Array.isArray(data.results) || !isQuestion(data.results[0])) {
    throw new Error('The API returned an invalid question.');
  }
  return data.results[0];
}

