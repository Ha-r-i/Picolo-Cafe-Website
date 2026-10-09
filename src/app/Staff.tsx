import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './Auth';
import { Feedback, useRemote } from './hooks';
import type { Role } from '../../shared/types';
import { StaffReservations } from './staff/StaffReservations';
import { StaffMenu } from './staff/StaffMenu';
import { StaffNotifications } from './staff/StaffNotifications';
import { StaffTeam } from './staff/StaffTeam';
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
  // Keep tool selection separate from the page layout.
  let activeTool = <StaffReservations onChange={metrics.reload} />;
  if (pathname.includes('/menu')) {
    activeTool = <StaffMenu onChange={metrics.reload} />;
  } else if (pathname.includes('/notifications')) {
    activeTool = <StaffNotifications />;
  } else if (pathname.includes('/team') && me.data.role === 'admin') {
    activeTool = <StaffTeam />;
  }
  const metricValues = metrics.data;

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
      {metricValues && (
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
              <strong>{metricValues[key]}</strong>
            </div>
          ))}
        </div>
      )}
      {activeTool}
    </div>
  );
}
