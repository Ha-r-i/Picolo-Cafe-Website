import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Page, Reservation } from '../../shared/types';
import { useAuth } from './Auth';
import { supabase } from './api';
import { Feedback, useRemote } from './hooks';
import { formatVisit } from './Booking';
type AuthMode = 'login' | 'signup' | 'reset' | 'password';

const successMessages: Record<AuthMode, string> = {
  login: 'You are signed in.',
  signup: 'Check your email to confirm your account before signing in.',
  reset: 'If that email belongs to an account, a reset link will arrive shortly.',
  password: 'Password updated.',
};

async function authenticate(mode: AuthMode, email: string, password: string) {
  if (!supabase) {
    throw new Error('Account access is unavailable.');
  }

  switch (mode) {
    case 'signup':
      return supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/account` },
      });
    case 'reset':
      return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/account`,
      });
    case 'password':
      return supabase.auth.updateUser({ password });
    case 'login':
      return supabase.auth.signInWithPassword({ email, password });
  }
}

export function Account({ staff = false }: { staff?: boolean }) {
  const { session, role, loading, logout } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const bookings = useRemote<Page<Reservation>>(session ? `/reservations/mine?page=${page}` : null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const response = await authenticate(mode, email, password);
      if (response.error) {
        throw response.error;
      }
      setSuccess(successMessages[mode]);
    } catch {
      setError('We could not complete that request. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="container page">
        <Feedback error="" loading />
      </div>
    );
  return (
    <div className="container page narrow">
      <p className="eyebrow">{staff ? 'THE PICCOLO TEAM' : 'YOUR LITTLE COFFEE CORNER'}</p>
      <h1>{session ? 'Hello again.' : staff ? 'Staff sign in.' : 'Make yourself at home.'}</h1>
      {!supabase && (
        <div role="alert" className="feedback error">
          Account access is unavailable. Please try again later.
        </div>
      )}
      {session && mode !== 'password' ? (
        <>
          <p>Signed in as {session.user.email}</p>
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => void logout().catch(() => setError('Sign out failed. Please retry.'))}
            >
              Sign out
            </button>
            <button className="text-link" onClick={() => setMode('password')}>
              Change password
            </button>
            {role && ['staff', 'admin'].includes(role) && (
              <Link to="/admin/dashboard" className="button">
                Open staff dashboard →
              </Link>
            )}
          </div>
          {staff && role === 'customer' && (
            <p role="alert">Your account does not have staff access.</p>
          )}
          <Feedback
            error={error || bookings.error}
            loading={bookings.loading}
            retry={bookings.reload}
          />
          <h2 className="section-title">Your reservations</h2>
          {bookings.data?.items.length === 0 && (
            <div className="empty">
              <p>
                You have no account bookings yet. Guest reservations stay accessible through their
                private links.
              </p>
              <Link to="/booking">Book a visit →</Link>
            </div>
          )}
          {bookings.data?.items.map((r) => (
            <article className="panel reservation-summary" key={r.id}>
              <span className="badge">{r.status}</span>
              <h3>{formatVisit(r.starts_at)}</h3>
              <p>{r.guests} guests</p>
              <Link to={`/reservation/${r.id}`} className="text-link">
                Manage reservation →
              </Link>
            </article>
          ))}
          {bookings.data && bookings.data.total > 20 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>Page {page}</span>
              <button disabled={page * 20 >= bookings.data.total} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <form className="panel" onSubmit={submit}>
            <h2>
              {mode === 'reset'
                ? 'Reset your password'
                : mode === 'signup'
                  ? 'Create an account'
                  : mode === 'password'
                    ? 'Choose a new password'
                    : 'Welcome back'}
            </h2>
            <fieldset disabled={busy || !supabase}>
              {mode !== 'password' && (
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" required maxLength={254} />
                </label>
              )}
              {mode !== 'reset' && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'login' ? 1 : 12}
                    maxLength={128}
                  />
                </label>
              )}
              <Feedback error={error} />
              {success && (
                <p role="status" className="feedback success">
                  {success}
                </p>
              )}
              <button className="button">
                {busy
                  ? 'Please wait…'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'password'
                        ? 'Save password'
                        : 'Sign in'}
              </button>
            </fieldset>
          </form>
          <div className="actions auth-options">
            <button
              className="text-link"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
              }}
            >
              Sign in
            </button>
            {!staff && !session && (
              <button
                className="text-link"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setSuccess('');
                }}
              >
                Create account
              </button>
            )}
            {!session && (
              <button
                className="text-link"
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setSuccess('');
                }}
              >
                Forgot password?
              </button>
            )}
            {session && (
              <button className="text-link" onClick={() => setMode('login')}>
                Back to account
              </button>
            )}
          </div>
          {!staff && (
            <p className="muted">
              You can also <Link to="/booking">reserve as a guest</Link>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
