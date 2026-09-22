import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'role';

const TONE_CLASS: Record<BadgeTone, string> = {
  success: 'badge badge--success',
  danger: 'badge badge--danger',
  warning: 'badge badge--warning',
  info: 'badge badge--info',
  neutral: 'badge badge--neutral',
  role: 'badge badge--role',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}

export function Badge({ tone = 'neutral', children, title }: BadgeProps) {
  return (
    <span className={TONE_CLASS[tone]} title={title}>
      {children}
    </span>
  );
}