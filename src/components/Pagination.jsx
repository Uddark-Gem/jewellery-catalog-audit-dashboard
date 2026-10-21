import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);

export default function Pagination({
  page = 1,
  pageCount = 1,
  pageSize = 100,
  pageSizeOptions = [10, 25, 50, 100, 250],
  totalEntries = 0,
  selectedCount = 0,
  onPageChange,
  onPageSizeChange,
}) {
  const startIndex = totalEntries === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalEntries);

  const getPageNumbers = () => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', pageCount];
    }

    if (page >= pageCount - 3) {
      return [1, '...', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
    }

    return [1, '...', page - 1, page, page + 1, '...', pageCount];
  };

  const pages = getPageNumbers();

  return (
    <div className="table-footer flex items-center justify-between flex-wrap gap-4 px-5 py-3 border-t border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-6">
        <span className="font-medium text-slate-500 dark:text-slate-400">
          {formatNumber(selectedCount)} rows selected
        </span>
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          Showing {formatNumber(startIndex)} to {formatNumber(endIndex)} of {formatNumber(totalEntries)} entries
        </span>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 font-medium">
          <span>Rows per page</span>
          <select
            className="border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous Page"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>

          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-400">
                  ...
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <button
                key={p}
                type="button"
                className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-md text-xs font-semibold transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                }`}
                onClick={() => onPageChange(p)}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {formatNumber(p)}
              </button>
            );
          })}

          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next Page"
          >
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
