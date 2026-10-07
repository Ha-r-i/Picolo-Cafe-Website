import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CafeSettings, Reservation } from '../../shared/types';
import { api } from './api';
import { Feedback, useRemote } from './hooks';
import { useAuth } from './Auth';
export function formatVisit(value: string, timezone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}
function today(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function Booking() {
  const config = useRemote<CafeSettings>('/settings');
  const { session } = useAuth();
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('2');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ reservation: Reservation; guest_token?: string } | null>(
    null,
  );
  const available = useRemote<{
    slots: { starts_at: string; available: boolean }[];
    timezone: string;
  }>(date ? `/availability?date=${date}&guests=${guests}` : null);
  useEffect(() => {
    setTime('');
  }, [date, guests]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!time) return;
    const form = new FormData(e.currentTarget);
    const data = {
      name: String(form.get('name')),
      email: String(form.get('email')),
      phone: String(form.get('phone')),
      starts_at: new Date(time).toISOString(),
      guests: Number(guests),
      notes: String(form.get('notes')),
      website: String(form.get('website')),
    };
    const payload = JSON.stringify(data);
    const scope = session?.user.id ?? 'guest';
    const previous = JSON.parse(sessionStorage.getItem('piccolo-booking-request') ?? 'null') as {
      payload: string;
      key: string;
      scope: string;
    } | null;
    const key =
      previous?.payload === payload && previous.scope === scope
        ? previous.key
        : crypto.randomUUID();
    sessionStorage.setItem('piccolo-booking-request', JSON.stringify({ payload, key, scope }));
    setBusy(true);
    setError('');
    try {
      setResult(
        await api('/reservations', {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: payload,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (result) {
    const r = result.reservation;
    const link = `/reservation/${r.id}${result.guest_token ? `#${result.guest_token}` : ''}`;
    return (
      <div className="container page narrow">
        <div className="confirmation">
          <span className="success-mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">YOUR REQUEST IS SAVED</p>
          <h1>
            See you <em>soon.</em>
          </h1>
          <p>
            Capacity is reserved while staff confirm your visit. Your current status is{' '}
            <strong>{r.status}</strong>.
          </p>
          <p>
            {r.name} · {r.guests} guests
            <br />
            {formatVisit(r.starts_at, config.data?.timezone)}
            <br />
            Reference: <span className="reference">{r.id}</span>
          </p>
          <Link to={link} className="button">
            View or cancel reservation →
          </Link>
          {result.guest_token && (
            <p className="muted">
              Save the private link on the next page. Anyone with that link can view or cancel this
              booking.
            </p>
          )}
          <p className="muted">
            Keep this confirmation and use your booking page to check the latest status.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="container page">
      <div className="page-intro">
        <p className="eyebrow">GOOD COMPANY STARTS HERE</p>
        <h1>
          Save your <em>seat.</em>
        </h1>
        <p>A few details, and a little something to look forward to.</p>
      </div>
      <Feedback error={config.error} loading={config.loading} retry={config.reload} />
      {config.data && (
        <div className="booking-grid">
          <form className="panel booking-form" onSubmit={submit}>
            <fieldset disabled={busy}>
              <legend>Your visit</legend>
              <div className="form-grid">
                <label>
                  Date
                  <input
                    required
                    type="date"
                    min={today(config.data.timezone)}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label>
                  Guests
                  <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                    {Array.from({ length: config.data.max_party_size }, (_, i) => (
                      <option key={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Available time
                <select
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={!available.data || available.loading}
                >
                  <option value="">{date ? 'Choose a time' : 'Choose a date first'}</option>
                  {available.data?.slots.map((t) => (
                    <option key={t.starts_at} value={t.starts_at} disabled={!t.available}>
                      {new Intl.DateTimeFormat('en-IN', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: config.data!.timezone,
                      }).format(new Date(t.starts_at))}
                      {t.available ? '' : ' · Fully booked'}
                    </option>
                  ))}
                </select>
              </label>
              <Feedback
                error={available.error}
                loading={available.loading}
                retry={available.reload}
              />
              {available.data?.slots.length === 0 && (
                <p role="status">
                  No times are available for this date. Please choose another day.
                </p>
              )}
              <h2 className="form-section-title">Your details</h2>
              <div className="form-grid">
                <label>
                  Full name
                  <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
                </label>
                <label>
                  Phone
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    pattern="\+?[0-9 \(\)\-]{7,20}"
                    placeholder="+91 98765 43210"
                  />
                </label>
              </div>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={session?.user.email}
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Anything we should know? <span className="muted">(optional)</span>
                <textarea
                  name="notes"
                  maxLength={1000}
                  rows={3}
                  placeholder="Accessibility needs, a special occasion…"
                />
              </label>
              <div className="honeypot" aria-hidden="true">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <Feedback error={error} />
              <button className="button" disabled={!time || busy}>
                {busy ? 'Saving your reservation…' : 'Request reservation ↗'}
              </button>
              <p className="muted small-print">
                {session
                  ? 'This reservation will be linked to your account.'
                  : 'You can book as a guest. Save your private link after booking.'}
              </p>
            </fieldset>
          </form>
          <aside className="booking-aside">
            <img
              src="/images/cafe-640.webp"
              alt="A welcoming table inside Piccolo Cafe"
              width="640"
              height="427"
            />
            <div className="panel">
              <p className="eyebrow">A FEW THINGS TO KNOW</p>
              <h2>Take your time.</h2>
              <p>
                Your visit lasts {config.data.duration_minutes} minutes. Book at least{' '}
                {config.data.lead_minutes} minutes ahead.
              </p>
              <p>
                Cancel until {config.data.cancellation_minutes} minutes before your visit using your
                booking page.
              </p>
              <p>All times are shown in {config.data.timezone}.</p>
              <details>
                <summary>Opening hours</summary>
                {Object.entries(config.data.opening_hours).map(([day, hours]) => (
                  <p key={day}>
                    {
                      [
                        'Sunday',
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday',
                      ][Number(day)]
                    }
                    : {hours ? `${hours.open}–${hours.close}` : 'Closed'}
                  </p>
                ))}
              </details>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
export function ManageBooking() {
  const { id } = useParams();
  const [token, setToken] = useState(() => location.hash.slice(1));
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function load() {
    setError('');
    setBusy(true);
    try {
      setReservation(await api(`/reservations/${id}`, { headers: { 'X-Booking-Token': token } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function cancel() {
    setBusy(true);
    setError('');
    try {
      setReservation(
        await api(`/reservations/${id}/status`, {
          method: 'PATCH',
          headers: { 'X-Booking-Token': token },
          body: JSON.stringify({ version: reservation!.version, status: 'cancelled' }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page narrow">
      <p className="eyebrow">YOUR VISIT TO PICCOLO</p>
      <h1>
        Your <em>reservation.</em>
      </h1>
      <Feedback error={error} loading={busy} />
      {reservation ? (
        <div className="panel">
          <span className={`badge ${reservation.status}`}>{reservation.status}</span>
          <h2>{reservation.name}</h2>
          <p>
            {formatVisit(reservation.starts_at)}
            <br />
            {reservation.guests} guests · until {formatVisit(reservation.ends_at)}
          </p>
          <p className="reference">Reference: {reservation.id}</p>
          {['pending', 'confirmed'].includes(reservation.status) && (
            <button className="button secondary" disabled={busy} onClick={() => void cancel()}>
              Cancel reservation
            </button>
          )}
          <button className="button secondary" disabled={busy} onClick={() => void load()}>
            Refresh status
          </button>
          {token && (
            <>
              <p className="muted">Keep this private booking link somewhere safe.</p>
              <button
                className="text-link"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(`${location.origin}/reservation/${id}#${token}`)
                    .then(() => setCopied(true))
                    .catch(() => setError('Copy the page address to save your private link.'))
                }
              >
                {copied ? 'Private link copied' : 'Copy private link'}
              </button>
            </>
          )}
        </div>
      ) : (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label>
            Private booking token
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              maxLength={256}
              autoComplete="off"
            />
          </label>
          <button className="button" disabled={busy}>
            View reservation
          </button>
          <p>Signed-in customers can open their own bookings without a token.</p>
        </form>
      )}
    </div>
  );
}
