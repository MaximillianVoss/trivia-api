# Trivia API — от пустой папки до объяснения решения

Стек: **React Web + TypeScript + Vite**. Это сайт, открываемый в браузере; Expo и React Native здесь не используются.

[Краткое условие отдельно](ASSIGNMENT.md) · [Клонирование и запуск на Mac](../README.md)

## 1. Что требуется и что получится

Обязательная часть — 3 балла:

1. Показывать начальную фразу `Click the button to get a trivia question!`.
2. Запрашивать один вопрос **только после кнопки**, а не при открытии.
3. Использовать `https://opentdb.com/api.php?amount=1`.
4. После первого успеха показывать вопрос вместо начальной фразы.
5. При HTTP 429 выводить `Please try again in a moment.`.

В готовом решении также есть индикатор загрузки, блокировка повторного нажатия, тайм-аут 15 секунд, понятные ошибки, декодирование HTML-сущностей и раскрываемый ответ. Это улучшения, а не новые обязательные условия.

Маршрут: **проверить Node → открыть нужную папку → установить зависимости → разобрать src → запустить → проверить сценарии → собрать production → объяснить работу**.

## 2. Подготовка и быстрый запуск на Mac

Склонируйте репозиторий по [инструкции](../README.md). Откройте Terminal именно в корне `trivia-api`. Это каталог, в котором видны `package.json`, `package-lock.json`, `index.html` и `src`.

```bash
node --version
npm --version
```

Для воспроизводимого учебного запуска используйте ветку Node **24**; она указана в `.nvmrc`. Если у вас уже настроен nvm, можно выбрать ветку Node 24:

```bash
nvm install 24
nvm use 24
```

Если `nvm: command not found`, это не ошибка проекта: nvm не установлен. Подойдёт установленный Node 24; устанавливать nvm только ради запуска необязательно.

После клонирования по инструкции README перейдите в папку проекта:

```bash
cd "$HOME/Projects/trivia-api"
npm ci
npm run dev
```

В поставляемом проекте **есть package-lock.json**, поэтому `npm ci` работает.
Если вы воссоздали проект вручную и lock-файла ещё нет, первый раз выполните `npm install`; он создаст lock. Не запускайте `npm ci` в родительской папке без `package.json`.

Откройте URL из терминала, обычно `http://127.0.0.1:5173`. Если порт занят, Vite сообщит фактический адрес. Можно выбрать свой:

```bash
npm run dev -- --port 5178
```

Остановка — **Ctrl+C**. Эта команда останавливает сервер; исходники не удаляет.

## 3. Если работа выполняется в GitHub Classroom

В существующем Vite/TypeScript-репозитории входная точка — обычно `src/main.tsx`, которая импортирует `src/App.tsx`.
Файл `App.tsx` в корне проекта при этом **не используется**.

1. Сохраните копию своего проекта или свои изменения в Git.
2. Сравните `src/main.tsx` и путь импорта `App`.
3. Перенесите из решения полное содержимое `src/App.tsx`, `src/api.ts`, `src/styles.css`, `src/main.tsx`.
4. Не смешивайте `View`, `Text`, `StyleSheet` из React Native с HTML-тегами этого решения.
5. Не заменяйте вслепую служебные файлы `.github` и настройки преподавательских тестов.
6. Используйте команды из своего `package.json`. При копировании **всего отдельного проекта** команды точно такие, как в разделе 2.

Поставляемые автоматические тесты дополнительно используют файлы `src/App.test.tsx`, `src/test/setup.ts` и настройки из `vite.config.ts`.

## 4. Короткая теория

### Компонент и состояние

`App` — функция, возвращающая JSX. React вызывает её, чтобы построить интерфейс.
`useState` хранит значение между отображениями компонента. Мы храним:

| Состояние | Тип | Зачем |
| --- | --- | --- |
| `question` | `TriviaQuestion \| null` | `null` означает: ещё нет успешно полученного вопроса. |
| `loading` | `boolean` | Кнопка и индикатор знают, выполняется ли запрос. |
| `error` | `string` | Текст ошибки показывается отдельно от вопроса. |

Менять обычную локальную переменную вместо `setQuestion` недостаточно: React не получит сигнал перерисовать компонент.

### Обработчик вместо эффекта

`handleGetQuestion` вызывается через `onClick`.
В приложении **нет `useEffect`**, потому что условие запрещает загрузку вопроса на старте.
Передача `onClick={handleGetQuestion}` передаёт функцию; запись `onClick={handleGetQuestion()}` ошибочно вызвала бы её во время рендера.

### Асинхронный запрос

`await fetch(...)` ожидает HTTP-ответ, а `await response.json()` читает его тело.
Статус 429 — это полученный HTTP-ответ, поэтому его проверяем явно: `fetch` не считает каждый HTTP-код 4xx/5xx сетевым исключением.

`try` выполняет основной путь, `catch` показывает ошибку, `finally` снимает состояние загрузки и при успехе, и при неудаче.

## 5. Пошаговая реализация

### Шаг 1. Создать описание данных

В `api.ts` интерфейс `TriviaQuestion` описывает используемые поля вопроса. TypeScript помогает не перепутать их имена.

JSON приходит извне, поэтому `payload` сначала имеет тип `unknown`. Проверки `typeof`, `Array.isArray` и функция `isQuestion` подтверждают фактическую структуру перед использованием.
Простое `as TriviaQuestion` без проверки не проверяло бы сервер.

### Шаг 2. Написать fetchQuestion

Функция:

1. Делает запрос к точному endpoint.
2. Ограничивает ожидание 15 секундами через `AbortSignal.timeout`.
3. Отдельно проверяет HTTP 429.
4. Проверяет остальные неуспешные статусы.
5. Читает JSON и проверяет его структуру.
6. Обрабатывает `response_code: 5` тем же сообщением о частоте.
7. Возвращает первый и единственный запрошенный вопрос.

Open Trivia DB документирует код 5 и интервал в 5 секунд. Это дополнение защищает от варианта, когда ограничение сообщается в JSON, а не HTTP-статусом. [Документация Open Trivia DB](https://opentdb.com/api_config.php).

### Шаг 3. Подключить обработчик

В `handleGetQuestion` сначала включается `loading`, очищается предыдущая ошибка, затем выполняется `fetchQuestion`.
Успешный результат передаётся в `setQuestion`. Если новый запрос не удался, предыдущий успешно полученный вопрос остаётся; сверху появляется ошибка.

### Шаг 4. Условно отобразить содержимое

Выражение `question ? (...) : (...)` выбирает между карточкой вопроса и точной начальной фразой.
`error && ...` показывает сообщение только при непустой строке ошибки.

### Шаг 5. Декодировать текст

API может прислать `&quot;` или `&amp;`. Функция `decodeHtml` получает обычный текст через отдельный textarea.
Этот элемент **не вставляется в документ**, а возвращённая строка выводится React как текст. В приложении нет `dangerouslySetInnerHTML`.

### Шаг 6. Добавить необязательный ответ

`<details>` и `<summary>` — стандартные элементы браузера для раскрываемого блока.
`key={question.question}` пересоздаёт этот блок для другого вопроса, чтобы новый ответ снова был скрыт.
Одинаковый вопрос API теоретически может вернуть повторно; уникальность вопросов условием не требовалась.

## 6. Карта функций и решений

| Элемент | Где | Почему так |
| --- | --- | --- |
| `App` | App.tsx | Отвечает за состояние и JSX, но не разбирает вручную формат API. |
| `handleGetQuestion` | App.tsx | Единственная точка запуска запроса пользователем. |
| `fetchQuestion` | api.ts | Объединяет HTTP, проверку ответа и сообщения об ошибках. |
| `isQuestion` | api.ts | Не допускает использования повреждённого JSON как вопроса. |
| `decodeHtml` | api.ts | Убирает HTML-сущности без вставки чужого HTML в страницу. |
| `finally` | App.tsx | Не оставляет кнопку навсегда заблокированной после ошибки. |
| `disabled={loading}` | App.tsx | Не позволяет отправить несколько запросов обычными повторными кликами. |
| `aria-live`, `role="alert"` | App.tsx | Сообщают изменения и ошибки вспомогательным технологиям. |
| `createRoot` | main.tsx | Подключает React к `<div id="root">` из index.html. |

Локального таймера на 5 секунд нет: условие требует **обработать ответ API**, а общий лимит по IP всё равно может затронуть другие устройства. Не проверяйте лимит десятками быстрых запросов: для этого есть автоматический тест.

## 7. Проверка, сборка и сдача

```bash
npm test
npm run build
npm run preview
```

- `npm test` запускает 9 автоматических проверок с подменённым `fetch`, без нагрузки на внешний API.
- `npm run build` проверяет TypeScript и создаёт статический сайт в `dist`.
- `npm run preview` показывает эту готовую сборку. После изменения исходников сборку нужно повторить.
- Не открывайте `index.html` двойным кликом: используйте Vite.

Ручной чек-лист:

1. Перезагрузить страницу с открытой вкладкой Network: запроса к `opentdb.com` ещё нет.
2. Проверить точную начальную фразу.
3. Нажать кнопку один раз: во время запроса она заблокирована.
4. Проверить появление вопроса и отсутствие `&quot;` в отображаемом тексте.
5. Раскрыть ответ.
6. Подождать 5 секунд, повторить запрос.
7. В DevTools включить Offline, нажать кнопку: появляется ошибка, кнопка снова доступна.
8. Выключить Offline перед продолжением.
9. HTTP 429 и JSON-код 5 подтверждаются тестами, а не намеренным исчерпанием лимита.

Для сдачи нужны исходники, конфигурация и `package-lock.json`. `node_modules` и `dist` обычно не коммитят, если преподаватель явно не просит другое. Клонирование учебного репозитория не означает сдачу в Classroom или Moodle; её выполняют отдельно по правилам преподавателя.

## 8. Частые ошибки

| Симптом | Проверка |
| --- | --- |
| Показывается стандартный счётчик Vite | Изменён не тот App.tsx; нужен `src/App.tsx`. |
| `react/jsx-runtime` не найден | Выполнить `npm ci` в правильной папке и проверить версию Node. |
| `npm ci` требует lock-файл | В готовом проекте он есть; в созданном вручную первый раз нужен `npm install`. |
| SyntaxError/незакрытый JSX-тег | Сверить файл целиком с листингом ниже, не вставлять только половину компонента. |
| `Failed to fetch` | Проверить сеть, Offline в DevTools, доступность API; это не всегда ошибка TypeScript. |
| Сообщение про слишком частые запросы | Подождать; лимит общий для IP, а не только этой вкладки. |
| `AbortSignal.timeout` не поддерживается | Использовать современный браузер; проект проверяется в актуальном Chromium. |

## 9. Полное содержимое файлов

Ниже приведены исходники и небольшие конфигурационные файлы **целиком**. Сгенерированный большой `package-lock.json` нужно брать из готового проекта, не переписывать вручную. Тестовые файлы тоже включены, чтобы было понятно, что проверяется.

### `package.json`

```json
{
  "name": "trivia-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.0",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "24.13.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.2",
    "jsdom": "27.4.0",
    "typescript": "6.0.2",
    "vite": "8.1.0",
    "vitest": "4.1.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": [
      "vite/client",
      "@testing-library/jest-dom",
      "node"
    ]
  },
  "include": [
    "src",
    "stages/*/src",
    "vite.config.ts"
  ]
}
```

### `vite.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Trivia API</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `.nvmrc`

```text
24
```

### `.gitignore`

```text
node_modules/
dist/
coverage/
.DS_Store
*.log
```

### `src/api.ts`

```ts
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
```

### `src/App.test.tsx`

```tsx
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
```

### `src/App.tsx`

```tsx
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
```

### `src/main.tsx`

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element was not found.');
createRoot(root).render(<App />);
```

### `src/styles.css`

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: #1c2940;
  background: #f2f5fc;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
.page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.card {
  width: min(100%, 780px); padding: clamp(24px, 6vw, 56px); border-radius: 28px;
  background: white; border: 1px solid #dbe3f1; box-shadow: 0 20px 70px #21335e12;
}
.eyebrow { color: #5a60a3; font-size: .8rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
h1 { font-size: clamp(2rem, 6vw, 3.15rem); line-height: 1.08; max-width: 15ch; margin: 20px 0; }
.intro { color: #64708a; margin-bottom: 28px; }
button {
  font: inherit; font-weight: 700; border: 0; border-radius: 12px;
  padding: 14px 20px; color: white; background: #5046c7; cursor: pointer;
}
button:hover { background: #3e36a5; }
button:disabled { cursor: wait; opacity: .65; }
button:focus-visible, summary:focus-visible, a:focus-visible { outline: 3px solid #d7a325; outline-offset: 4px; }
.question { border-top: 1px solid #e2e7f2; margin-top: 32px; padding-top: 22px; }
.metadata { color: #5a60a3; font-size: .85rem; }
h2 { line-height: 1.45; font-size: 1.4rem; overflow-wrap: anywhere; }
details { background: #f3f4fd; padding: 16px; border-radius: 12px; }
summary { cursor: pointer; font-weight: 650; }
.empty { padding: 30px 0 16px; color: #52617a; }
.error { color: #922b36; background: #fff0f1; padding: 14px; border-radius: 10px; }
.hint, .source { font-size: .8rem; color: #64708a; line-height: 1.6; }
.source { color: #5046c7; }
```

### `src/test/setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
```
