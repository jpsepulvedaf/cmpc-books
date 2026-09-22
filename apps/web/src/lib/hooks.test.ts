// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebounced } from './hooks';

describe('useDebounced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(({ value }) => useDebounced(value, 300), {
      initialProps: { value: 'a' },
    });
    expect(result.current).toBe('a');
  });

  it('keeps the old value until the delay elapses, then updates', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('b');
  });

  it('resets the timer while the value keeps changing (typing behavior)', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
      initialProps: { value: '' },
    });
    rerender({ value: 'x' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'xy' });
    act(() => {
      vi.advanceTimersByTime(200); // 300ms total but the clock was reset → still debouncing
    });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('xy');
  });

  it('honors a custom delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 500), {
      initialProps: { value: 1 },
    });
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });

  it('cancels the pending timer on unmount without crashing', () => {
    const { result, unmount, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'b' });
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('a');
  });
});