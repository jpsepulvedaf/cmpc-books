import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { ApiError } from '../../lib/api';
import { resetSessionExpiredNotified } from '../../lib/api';
import { setSession, getSession } from '../../lib/session';
import { loginSchemas, toLoginPayload, zodField, type LoginFormValues } from '../../lib/validators';
import { loginRequest } from './api';
import { FieldError, FormAlert, fieldErrorId, getFieldError } from '../../shared/Form';

export function LoginPage() {
  const navigate = useNavigate();
  const session = getSession();

  const { register, handleSubmit, formState } = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
    shouldUseNativeValidation: false,
  });

  const login = useMutation({
    mutationFn: (values: LoginFormValues) => {
      const payload = toLoginPayload(values);
      return loginRequest(payload.email, payload.password);
    },
  });

  const fieldError = (name: keyof LoginFormValues) => getFieldError(formState.errors, name);

  if (session) {
    return <Navigate to="/libros" replace />;
  }

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (result) => {
        setSession(result.token, result.user);
        resetSessionExpiredNotified();
        navigate('/libros', { replace: true });
      },
    });
  });

  const apiMessage = login.error ? (login.error as ApiError).userMessage : undefined;

  return (
    <div className="login-screen">
      <div className="card login-card">
        <div className="login-brand" aria-label="CMPC Libros">
          <img
            src="/logo.png"
            alt="CMPC Libros"
            className="login-logo"
            width={240}
            height={120}
          />
        </div>

        <form className="form" noValidate onSubmit={onSubmit}>
          <FormAlert message={apiMessage} />

          <div className="field">
            <label htmlFor="login-email">Correo electrónico</label>
            <input
              {...register('email', {
                validate: zodField(loginSchemas.email),
              })}
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="correo@ejemplo.cl"
              aria-invalid={fieldError('email') ? 'true' : undefined}
              aria-describedby={fieldError('email') ? fieldErrorId('email') : undefined}
            />
            <FieldError name="email" message={fieldError('email')} />
          </div>

          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              {...register('password', {
                validate: zodField(loginSchemas.password),
              })}
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={fieldError('password') ? 'true' : undefined}
              aria-describedby={fieldError('password') ? fieldErrorId('password') : undefined}
            />
            <FieldError name="password" message={fieldError('password')} />
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={login.isPending}>
            {login.isPending ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}