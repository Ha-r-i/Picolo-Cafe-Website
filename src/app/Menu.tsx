import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category, MenuItem, Page } from '../../shared/types';
import { imageUrl } from './api';
import { Feedback, useRemote } from './hooks';
export function Menu() {
  const [category, setCategory] = useState('');
  const [dietary, setDietary] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const categories = useRemote<Category[]>('/categories');
  const items = useRemote<Page<MenuItem>>(
    `/menu?${new URLSearchParams({ page: String(page), pageSize: '12', q, ...(category ? { category } : {}), ...(dietary ? { dietary } : {}) })}`,
  );
  return (
    <div className="container page">
      <div className="page-intro">
        <p className="eyebrow">A CUP, A PLATE, A LITTLE HAPPINESS</p>
        <h1>
          The <em>menu.</em>
        </h1>
        <p>Find something that feels like your kind of day.</p>
      </div>
      <div className="filter-bar">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(search);
          }}
        >
          <label className="sr-only" htmlFor="menu-search">
            Search the menu
          </label>
          <input
            id="menu-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coffee, small plates…"
          />
          <button className="button small">Search</button>
        </form>
        <label className="inline-label">
          Dietary preference
          <select
            value={dietary}
            onChange={(e) => {
              setPage(1);
              setDietary(e.target.value);
            }}
          >
            <option value="">All preferences</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="non_vegetarian">Non vegetarian</option>
          </select>
        </label>
      </div>
      <Feedback error={categories.error} retry={categories.reload} />
      <div className="chips" aria-label="Menu categories">
        <button
          aria-pressed={!category}
          onClick={() => {
            setCategory('');
            setPage(1);
          }}
        >
          All items
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            aria-pressed={category === c.id}
            onClick={() => {
              setCategory(c.id);
              setPage(1);
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
      <Feedback error={items.error} loading={items.loading} retry={items.reload} />
      {items.data?.items.some((i) => i.sample_data) && (
        <p className="sample-note">
          Development sample menu. Items and prices are for demonstration.
        </p>
      )}
      {items.data?.items.length === 0 && (
        <div className="empty">
          <h2>Nothing here just yet.</h2>
          <p>Try another category or a different search.</p>
          <button
            className="button secondary"
            onClick={() => {
              setSearch('');
              setQ('');
              setCategory('');
              setDietary('');
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="menu-grid">
        {items.data?.items.map((i) => (
          <article className="menu-card" key={i.id}>
            {i.image_path && (
              <img
                loading="lazy"
                width="600"
                height="400"
                src={imageUrl(i.image_path)}
                alt={i.name}
              />
            )}
            <div className="menu-card-top">
              <span className="eyebrow">
                {categories.data?.find((c) => c.id === i.category_id)?.name}
              </span>
              <span className="diet">{i.dietary.replace('_', ' ')}</span>
            </div>
            <div className="menu-title">
              <h2>{i.name}</h2>
              <span>₹{(i.price_paise / 100).toLocaleString('en-IN')}</span>
            </div>
            <p>{i.description}</p>
            {i.sample_data && <small>Sample item</small>}
          </article>
        ))}
      </div>
      {items.data && items.data.total > 12 && (
        <div className="pagination">
          <button
            className="button secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(items.data.total / 12)}
          </span>
          <button
            className="button secondary"
            disabled={page * 12 >= items.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      <div className="menu-bottom">
        <p>Make a little time to enjoy it.</p>
        <Link to="/booking" className="text-link">
          Reserve a table →
        </Link>
      </div>
    </div>
  );
}
