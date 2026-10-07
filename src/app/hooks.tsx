import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
export function useRemote<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setData(null);
    setError('');
    setLoading(Boolean(path));
    if (path)
      void api<T>(path, { signal: controller.signal })
        .then((value) => {
          if (active) setData(value);
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, revision]);
  return { data, error, loading, reload };
}
export function Feedback({
  error,
  loading,
  retry,
}: {
  error: string;
  loading?: boolean;
  retry?: () => void;
}) {
  if (error)
    return (
      <div role="alert" className="feedback error">
        <p>{error}</p>
        {retry && (
          <button onClick={retry} className="button secondary">
            Try again
          </button>
        )}
      </div>
    );
  return loading ? (
    <p role="status" className="loading">
      Just a moment…
    </p>
  ) : null;
}
