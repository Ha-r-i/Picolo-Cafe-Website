export function Pager({
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
