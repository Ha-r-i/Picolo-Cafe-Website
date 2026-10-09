import { useState } from 'react';
import { Feedback, useRemote } from '../hooks';
import type { NotificationEvent, Page } from '../../../shared/types';
import { Pager } from './Pager';
export function StaffNotifications() {
  const [page, setPage] = useState(1);
  const jobs = useRemote<Page<NotificationEvent>>(`/admin/notifications?page=${page}`);
  return (
    <>
      <div className="section-heading">
        <h2>Notification delivery</h2>
        <button className="button secondary small" onClick={jobs.reload}>
          Refresh
        </button>
      </div>
      <p>
        Bookings remain saved when email delivery fails. Failed events require operator
        investigation; automatic retries are bounded to the provider’s deduplication window.
      </p>
      <Feedback error={jobs.error} loading={jobs.loading} retry={jobs.reload} />
      {jobs.data?.items.length === 0 && <p className="empty">No notification events yet.</p>}
      {jobs.data?.items.map((job) => (
        <article key={job.id} className="panel notification">
          <span className="badge">{job.status}</span>
          <span className="reference">{job.reservation_id}</span>
          <span>{job.attempts} attempts</span>
          {job.last_error && <span>{job.last_error}</span>}
        </article>
      ))}
      {jobs.data && <Pager page={page} total={jobs.data.total} setPage={setPage} />}
    </>
  );
}
