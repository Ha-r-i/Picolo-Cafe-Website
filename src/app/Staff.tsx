import { useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api, imageUrl } from './api';
import { useAuth } from './Auth';
import { Feedback, useRemote } from './hooks';
import { formatVisit } from './Booking';
import {
  statuses,
  transitions,
  type AuditEvent,
  type Category,
  type MenuItem,
  type NotificationEvent,
  type Page,
  type Reservation,
  type Role,
} from '../../shared/types';
export function Staff() {
  const { session, logout } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const me = useRemote<{ role: Role }>(session ? '/me' : null);
  const { pathname } = useLocation();
  const metrics = useRemote<Record<string, number>>(
    me.data && me.data.role !== 'customer' ? '/admin/metrics' : null,
  );
  if (!session)
    return (
      <div className="container page">
        <h1>Staff access</h1>
        <Link to="/admin/login" className="button">
          Sign in →
        </Link>
      </div>
    );
  if (me.loading)
    return (
      <div className="container page">
        <Feedback loading error="" />
      </div>
    );
  if (me.error || !me.data || me.data.role === 'customer')
    return (
      <div className="container page">
        <h1>Staff access required</h1>
        <Feedback error={me.error} retry={me.reload} />
        <p>A cafe administrator must assign your role before you can use these tools.</p>
        <Link to="/account">Your account →</Link>
      </div>
    );
  return (
    <div className="container page staff">
      <div className="staff-heading">
        <div>
          <p className="eyebrow">PICCOLO · {me.data.role.toUpperCase()}</p>
          <h1>The cafe desk.</h1>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            void logout().catch(() => setLogoutError('Sign out failed. Please retry.'))
          }
        >
          Sign out
        </button>
      </div>
      <nav className="staff-tabs" aria-label="Staff tools">
        <NavLink to="/admin/dashboard">Overview</NavLink>
        <NavLink to="/admin/reservations">Reservations</NavLink>
        <NavLink to="/admin/menu">Menu</NavLink>
        <NavLink to="/admin/notifications">Notifications</NavLink>
        {me.data.role === 'admin' && <NavLink to="/admin/team">Team access</NavLink>}
      </nav>
      <Feedback
        error={logoutError || metrics.error}
        loading={metrics.loading}
        retry={metrics.reload}
      />
      {metrics.data && (
        <div className="metrics">
          {[
            ['visits_today', 'Visits today'],
            ['guests_today', 'Guests today'],
            ['pending', 'Awaiting confirmation'],
            ['published_items', 'Published menu items'],
            ['failed_notifications', 'Failed notifications'],
          ].map(([key, label]) => (
            <div className="metric" key={key}>
              <span>{label}</span>
              <strong>{metrics.data![key]}</strong>
            </div>
          ))}
        </div>
      )}
      {pathname.includes('/menu') ? (
        <StaffMenu onChange={metrics.reload} />
      ) : pathname.includes('/notifications') ? (
        <Notifications />
      ) : pathname.includes('/team') && me.data.role === 'admin' ? (
        <Team />
      ) : (
        <StaffReservations onChange={metrics.reload} />
      )}
    </div>
  );
}
function StaffReservations({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [auditId, setAuditId] = useState<string | null>(null);
  const result = useRemote<Page<Reservation>>(
    `/admin/reservations?${new URLSearchParams({ page: String(page), q, ...(status ? { status } : {}), ...(date ? { date } : {}) })}`,
  );
  const audit = useRemote<AuditEvent[]>(auditId ? `/reservations/${auditId}/audit` : null);
  async function change(r: Reservation, next: string) {
    setBusy(r.id);
    setError('');
    try {
      await api(`/reservations/${r.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next, version: r.version }),
      });
      result.reload();
      onChange();
      if (auditId === r.id) audit.reload();
    } catch (e) {
      setError((e as Error).message);
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
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search);
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
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="button small">Search</button>
        </form>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
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
            onChange={(e) => {
              setDate(e.target.value);
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
        {result.data?.items.map((r) => (
          <article className="panel staff-reservation" key={r.id}>
            <div>
              <span className={`badge ${r.status}`}>{r.status}</span>
              <h3>{r.name}</h3>
              <p>
                {r.email}
                <br />
                {r.phone}
              </p>
              {r.notes && <p className="notes">{r.notes}</p>}
              <small className="reference">
                {r.id} · v{r.version}
              </small>
            </div>
            <div>
              <strong>{formatVisit(r.starts_at)}</strong>
              <p>
                {r.guests} guests
                <br />
                Until {formatVisit(r.ends_at)}
              </p>
            </div>
            <div>
              <div className="status-actions">
                {transitions[r.status].map((next) => (
                  <button
                    className="button secondary small"
                    disabled={Boolean(busy)}
                    onClick={() => void change(r, next)}
                    key={next}
                  >
                    {next.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <button
                className="text-link"
                onClick={() => setAuditId(auditId === r.id ? null : r.id)}
              >
                {auditId === r.id ? 'Hide history' : 'View history'}
              </button>
            </div>
            {auditId === r.id && (
              <div className="audit">
                <Feedback error={audit.error} loading={audit.loading} retry={audit.reload} />
                {audit.data?.map((a) => (
                  <p key={a.id}>
                    {a.from_status ?? 'created'} → {a.to_status} · {a.actor_kind} ·{' '}
                    {formatVisit(a.created_at)} · v{a.version}
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
const emptyItem = {
  category_id: '',
  name: '',
  description: '',
  price_paise: 0,
  dietary: 'vegetarian',
  image_path: null,
  published: false,
  featured: false,
} as const;
function StaffMenu({ onChange }: { onChange: () => void }) {
  const [page, setPage] = useState(1);
  const items = useRemote<Page<MenuItem>>(`/admin/menu?page=${page}`);
  const categories = useRemote<Category[]>('/admin/categories');
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      let image = editing.image_path ?? null;
      if (file) {
        const body = new FormData();
        body.append('file', file);
        image = (await api<{ path: string }>('/admin/uploads', { method: 'POST', body })).path;
      }
      const body = {
        category_id: String(f.get('category')),
        name: String(f.get('name')),
        description: String(f.get('description')),
        price_paise: Math.round(Number(f.get('price')) * 100),
        dietary: String(f.get('dietary')),
        image_path: image,
        published: f.get('published') === 'on',
        featured: f.get('featured') === 'on',
        ...(editing.id ? { version: editing.version } : {}),
      };
      await api(editing.id ? `/admin/menu/${editing.id}` : '/admin/menu', {
        method: editing.id ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      setEditing(null);
      setFile(null);
      items.reload();
      onChange();
      setSuccess('Menu saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function category(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    try {
      await api('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: String(f.get('category-name')),
          slug: String(f.get('slug')),
          position: 0,
        }),
      });
      categories.reload();
      form.reset();
      setSuccess('Category created.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Menu content</h2>
        <button
          className="button small"
          onClick={() => {
            setEditing({ ...emptyItem, category_id: categories.data?.[0]?.id ?? '' });
            setFile(null);
            setError('');
            setSuccess('');
          }}
        >
          Add menu item
        </button>
      </div>
      <Feedback
        error={error || items.error || categories.error}
        loading={items.loading}
        retry={() => {
          items.reload();
          categories.reload();
        }}
      />
      {success && (
        <p role="status" className="feedback success">
          {success}
        </p>
      )}
      {editing && (
        <form className="panel menu-editor" onSubmit={save} key={editing.id ?? 'new'}>
          <h3>{editing.id ? 'Edit item' : 'New item'}</h3>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label>
                Name
                <input name="name" defaultValue={editing.name} required maxLength={120} />
              </label>
              <label>
                Category
                <select name="category" defaultValue={editing.category_id} required>
                  <option value="">Choose category</option>
                  {categories.data?.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Price in rupees
                <input
                  type="number"
                  name="price"
                  min="0"
                  max="100000"
                  step="0.01"
                  defaultValue={(editing.price_paise ?? 0) / 100}
                  required
                />
              </label>
              <label>
                Dietary preference
                <select name="dietary" defaultValue={editing.dietary}>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="non_vegetarian">Non vegetarian</option>
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={editing.description}
                maxLength={1000}
                rows={3}
              />
            </label>
            <label>
              Menu image · JPEG, PNG or WebP, up to 3 MB
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {editing.image_path && (
              <div className="actions">
                <img
                  className="image-preview"
                  src={imageUrl(editing.image_path)}
                  alt="Current menu item"
                />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setEditing({ ...editing, image_path: null })}
                >
                  Remove image
                </button>
              </div>
            )}
            <div className="actions">
              <label className="checkbox">
                <input type="checkbox" name="published" defaultChecked={editing.published} />
                Published
              </label>
              <label className="checkbox">
                <input type="checkbox" name="featured" defaultChecked={editing.featured} />
                Featured
              </label>
            </div>
            <div className="actions">
              <button className="button">{busy ? 'Saving…' : 'Save menu item'}</button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setEditing(null);
                  setFile(null);
                }}
              >
                Cancel edit
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="menu-grid">
        {items.data?.items.map((i) => (
          <article className="menu-card" key={i.id}>
            <span className="badge">{i.published ? 'Published' : 'Draft'}</span>
            {i.sample_data && <span className="sample-note">Development sample</span>}
            <h3>{i.name}</h3>
            <p>
              ₹{(i.price_paise / 100).toFixed(2)} · v{i.version}
            </p>
            <button
              className="text-link"
              onClick={() => {
                setEditing(i);
                setFile(null);
                setError('');
                setSuccess('');
              }}
            >
              Edit item →
            </button>
          </article>
        ))}
      </div>
      {items.data?.items.length === 0 && (
        <p className="empty">Add your first menu item to get started.</p>
      )}
      {items.data && <Pager page={page} total={items.data.total} setPage={setPage} />}
      <details className="panel">
        <summary>Add a category</summary>
        <form onSubmit={category}>
          <div className="form-grid">
            <label>
              Category name
              <input name="category-name" required maxLength={100} />
            </label>
            <label>
              Category slug
              <input name="slug" required pattern="[a-z0-9-]{1,80}" placeholder="hot-coffee" />
            </label>
          </div>
          <button className="button small" disabled={busy}>
            Create category
          </button>
        </form>
      </details>
    </>
  );
}
function Notifications() {
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
      {jobs.data?.items.map((j) => (
        <article key={j.id} className="panel notification">
          <span className="badge">{j.status}</span>
          <span className="reference">{j.reservation_id}</span>
          <span>{j.attempts} attempts</span>
          {j.last_error && <span>{j.last_error}</span>}
        </article>
      ))}
      {jobs.data && <Pager page={page} total={jobs.data.total} setPage={setPage} />}
    </>
  );
}
function Team() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(`/admin/users/${f.get('id')}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: f.get('role') }),
      });
      setSuccess('Access updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel narrow" onSubmit={save}>
      <h2>Team permissions</h2>
      <p>
        Use the verified Supabase user ID of an existing account. Customers cannot assign their own
        permissions.
      </p>
      <label>
        User ID
        <input name="id" required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      </label>
      <label>
        Role
        <select name="role">
          <option>staff</option>
          <option>admin</option>
          <option>customer</option>
        </select>
      </label>
      <Feedback error={error} />
      {success && <p role="status">{success}</p>}
      <button className="button" disabled={busy}>
        {busy ? 'Saving…' : 'Update access'}
      </button>
    </form>
  );
}
function Pager({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (p: number) => void;
}) {
  return total > 20 ? (
    <div className="pagination">
      <button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {Math.ceil(total / 20)}
      </span>
      <button
        className="button secondary"
        disabled={page * 20 >= total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
    </div>
  ) : null;
}
