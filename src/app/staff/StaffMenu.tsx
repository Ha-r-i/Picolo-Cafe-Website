import { useState, type FormEvent } from 'react';
import { api, imageUrl } from '../api';
import { Feedback, useRemote } from '../hooks';
import type { Category, MenuItem, Page } from '../../../shared/types';
import { Pager } from './Pager';
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
export function StaffMenu({ onChange }: { onChange: () => void }) {
  const [page, setPage] = useState(1);
  const items = useRemote<Page<MenuItem>>(`/admin/menu?page=${page}`);
  const categories = useRemote<Category[]>('/admin/categories');
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formValues = new FormData(event.currentTarget);
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
        category_id: String(formValues.get('category')),
        name: String(formValues.get('name')),
        description: String(formValues.get('description')),
        price_paise: Math.round(Number(formValues.get('price')) * 100),
        dietary: String(formValues.get('dietary')),
        image_path: image,
        published: formValues.get('published') === 'on',
        featured: formValues.get('featured') === 'on',
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
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formValues = new FormData(event.currentTarget);
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      await api('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: String(formValues.get('category-name')),
          slug: String(formValues.get('slug')),
          position: 0,
        }),
      });
      categories.reload();
      form.reset();
      setSuccess('Category created.');
    } catch (caughtError) {
      setError((caughtError as Error).message);
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
                  {categories.data?.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
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
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
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
        {items.data?.items.map((menuItem) => (
          <article className="menu-card" key={menuItem.id}>
            <span className="badge">{menuItem.published ? 'Published' : 'Draft'}</span>
            {menuItem.sample_data && <span className="sample-note">Development sample</span>}
            <h3>{menuItem.name}</h3>
            <p>
              ₹{(menuItem.price_paise / 100).toFixed(2)} · v{menuItem.version}
            </p>
            <button
              className="text-link"
              onClick={() => {
                setEditing(menuItem);
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
        <form onSubmit={createCategory}>
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
