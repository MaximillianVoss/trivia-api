import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { decodeHtml, fetchQuestion, RATE_LIMIT_MESSAGE, TRIVIA_URL } from './api';

const question = {
  question: 'What is &quot;React&quot;?',
  category: 'Science &amp; Computers',
  difficulty: 'easy',
  correct_answer: 'A UI library',
};
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('Trivia API', () => {
  it('shows the exact initial message and does not fetch on mount', () => {
    render(<App />);
    expect(screen.getByText('Click the button to get a trivia question!')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches exactly one question after a click and decodes entities', async () => {
    fetchMock.mockResolvedValue(json({ response_code: 0, results: [question] }));
    render(<App />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('heading', { name: 'What is "React"?' })).toBeInTheDocument();
    expect(screen.queryByText('Click the button to get a trivia question!')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(TRIVIA_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it.each([429, 'code5'])('handles the rate limit %s with the exact message', async (kind) => {
    fetchMock.mockResolvedValue(kind === 429
      ? new Response('', { status: 429 })
      : json({ response_code: 5, results: [] }));
    render(<App />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent(RATE_LIMIT_MESSAGE);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('disables the button while a request is pending', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    render(<App />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(json({ response_code: 0, results: [question] }));
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  });

  it('shows network errors without crashing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<App />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });

  it('rejects malformed API results', async () => {
    fetchMock.mockResolvedValue(json({ response_code: 0, results: [{}] }));
    await expect(fetchQuestion()).rejects.toThrow('invalid question');
  });

  it('rejects HTTP failures', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    await expect(fetchQuestion()).rejects.toThrow('HTTP 500');
  });

  it('keeps decoded markup as text, never an active script', () => {
    expect(decodeHtml('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
  });
});

