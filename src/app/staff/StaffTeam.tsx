import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Feedback } from '../hooks';
export function StaffTeam() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formValues = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(`/admin/users/${formValues.get('id')}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: formValues.get('role') }),
      });
      setSuccess('Access updated.');
    } catch (caughtError) {
      setError((caughtError as Error).message);
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
