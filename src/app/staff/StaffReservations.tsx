import { useState } from 'react';
import { api } from '../api';
import { Feedback, useRemote } from '../hooks';
import { formatVisit } from '../Booking';
import {
  statuses,
  transitions,
  type AuditEvent,
  type Page,
  type Reservation,
} from '../../../shared/types';
import { Pager } from './Pager';
export function StaffReservations({ onChange }: { onChange: () => void }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [auditId, setAuditId] = useState<string | null>(null);
  const parameters = new URLSearchParams({ page: String(page), q: query });
  if (status) parameters.set('status', status);
  if (date) parameters.set('date', date);
  const result = useRemote<Page<Reservation>>('/admin/reservations?' + parameters);
  const audit = useRemote<AuditEvent[]>(auditId ? `/reservations/${auditId}/audit` : null);
  async function changeStatus(reservation: Reservation, next: string) {
    setBusy(reservation.id);
    setError('');
    try {
      await api(`/reservations/${reservation.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next, version: reservation.version }),
      });
      result.reload();
      onChange();
      if (auditId === reservation.id) audit.reload();
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Reservations</h2>
        <button
          className="button secondary small"
          onClick={() => {
            result.reload();
            onChange();
          }}
        >
          Refresh
        </button>
      </div>
      <div className="filter-bar">
        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search);
            setPage(1);
          }}
        >
          <label className="sr-only" htmlFor="reservation-search">
            Search reservations
          </label>
          <input
            id="reservation-search"
            placeholder="Name, email or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="button small">Search</button>
        </form>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Visit date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <Feedback error={error || result.error} loading={result.loading} retry={result.reload} />
      {result.data?.items.length === 0 && (
        <p className="empty">No reservations match your filters.</p>
      )}
      <div className="reservation-list">
        {result.data?.items.map((reservation) => (
          <article className="panel staff-reservation" key={reservation.id}>
            <div>
              <span className={`badge ${reservation.status}`}>{reservation.status}</span>
              <h3>{reservation.name}</h3>
              <p>
                {reservation.email}
                <br />
                {reservation.phone}
              </p>
              {reservation.notes && <p className="notes">{reservation.notes}</p>}
              <small className="reference">
                {reservation.id} · v{reservation.version}
              </small>
            </div>
            <div>
              <strong>{formatVisit(reservation.starts_at)}</strong>
              <p>
                {reservation.guests} guests
                <br />
                Until {formatVisit(reservation.ends_at)}
              </p>
            </div>
            <div>
              <div className="status-actions">
                {transitions[reservation.status].map((next) => (
                  <button
                    className="button secondary small"
                    disabled={Boolean(busy)}
                    onClick={() => void changeStatus(reservation, next)}
                    key={next}
                  >
                    {next.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <button
                className="text-link"
                onClick={() => setAuditId(auditId === reservation.id ? null : reservation.id)}
              >
                {auditId === reservation.id ? 'Hide history' : 'View history'}
              </button>
            </div>
            {auditId === reservation.id && (
              <div className="audit">
                <Feedback error={audit.error} loading={audit.loading} retry={audit.reload} />
                {audit.data?.map((auditEvent) => (
                  <p key={auditEvent.id}>
                    {auditEvent.from_status ?? 'created'} → {auditEvent.to_status} ·{' '}
                    {auditEvent.actor_kind} · {formatVisit(auditEvent.created_at)} · v
                    {auditEvent.version}
                  </p>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      {result.data && <Pager page={page} total={result.data.total} setPage={setPage} />}
    </>
  );
}
