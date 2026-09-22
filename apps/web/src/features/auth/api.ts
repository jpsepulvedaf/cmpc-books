// Auth endpoints.

import { api, unwrap } from '../../lib/api';
import type { SessionUser } from '../../lib/types';

export interface LoginResult {
  token: string;
  user: SessionUser;
}

export function loginRequest(email: string, password: string): Promise<LoginResult> {
  return unwrap<LoginResult>(api.post('/auth/login', { email, password }));
}