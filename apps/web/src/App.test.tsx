// Minimal App smoke test: verifies the root component module loads in isolation.
// (react-router-dom is mocked because createBrowserRouter requires a browser DOM,
// which vitest's node environment does not provide.)

import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('react-router-dom', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    createBrowserRouter: vi.fn(() => ({})),
    RouterProvider: passthrough,
    Navigate: passthrough,
    NavLink: passthrough,
    Link: passthrough,
    Outlet: () => null,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

import { App } from './App';

describe('App', () => {
  it('exports the root component', () => {
    expect(typeof App).toBe('function');
  });
});