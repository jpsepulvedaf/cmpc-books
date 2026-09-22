// @vitest-environment jsdom
// Covers src/main.tsx: mounting the root component when #root exists.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('./App', () => ({
  App: () => {
    calls.push('mounted');
    return null;
  },
}));

beforeEach(() => {
  calls.length = 0;
});

describe('main', () => {
  it('mounts the app into the #root element', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import('./main');
    // React 18 schedules the first commit; flush the task queue.
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls).toEqual(['mounted']);
    expect(document.getElementById('root')).not.toBeNull();
  });

  it('does nothing when the #root element is missing', async () => {
    document.body.innerHTML = '<div></div>';
    await import('./main');
    expect(calls.length).toBe(0);
  });
});