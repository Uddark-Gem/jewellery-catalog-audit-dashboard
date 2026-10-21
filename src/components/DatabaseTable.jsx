import { useEffect, useMemo, useState } from 'react';
import Pagination from './Pagination';
import { SearchIcon, XIcon, RotateCcwIcon } from './Icons';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250];
const toText = (value) => String(value ?? '').trim();
const toSearchText = (value) => toText(value).toLowerCase();
const compareValues = (a, b) => toText(a).localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const getColumnWidth = (column, sampleRows = []) => {
  const longestValue = sampleRows.reduce(
    (length, row) => Math.max(length, toText(row[column.key]).length),
    toText(column).length,
  );
  return Math.round(Math.min(Math.max(longestValue * 7.2 + 42, 80), 300));
};

export default function DatabaseTable({ columns = [], rows = [] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState('');
  const density = 'compact';
  const [sort, setSort] = useState({ key: '', direction: 'asc' });

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => columns.some((column) => toSearchText(row[column.key]).includes(query)));
  }, [rows, columns, search]);

  const sortedRows = useMemo(() => {
    if (!sort.key) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const result = compareValues(a[sort.key], b[sort.key]);
      return sort.direction === 'asc' ? result : -result;
    });
  }, [filteredRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const visibleRows = useMemo(() => sortedRows.slice(startIndex, startIndex + pageSize), [sortedRows, startIndex, pageSize]);
  const fittedColumns = useMemo(
    () => columns.map((column) => ({ key: column, width: getColumnWidth(column, visibleRows) })),
    [columns, visibleRows]
  );
  const tableMinWidth = useMemo(
    () => Math.max(900, fittedColumns.reduce((total, column) => total + column.width, 44)),
    [fittedColumns]
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sort]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: 'asc' };
    });
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="table-shell database-table-shell">
        <div className="table-toolbar">
          <div className="toolbar-search">
            <span className="toolbar-field-label">Search Database</span>
            <div className="toolbar-search-input-wrap">
              <SearchIcon className="search-icon w-4 h-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search database rows..."
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <button
            className="btn-ghost ml-auto"
            type="button"
            onClick={() => {
              setSearch('');
              setSort({ key: '', direction: 'asc' });
              setPageSize(100);
            }}
          >
            <RotateCcwIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>

        <div className={'panel-card flex-1 min-h-0 overflow-auto density-' + density}>
          <table className="data-table database-table interactive-table" style={{ width: tableMinWidth, minWidth: tableMinWidth }}>
            <thead>
              <tr>
                <th className="sticky-col index-col" style={{ width: 44 }}>#</th>
                {fittedColumns.map((column) => (
                  <th key={column.key} style={{ width: column.width, minWidth: column.width }}>
                    <button className="th-sort-button" type="button" onClick={() => toggleSort(column.key)}>
                      <span>{column.key}</span>
                      <span className="sort-indicator">{sort.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td className="empty-table-cell" colSpan={fittedColumns.length + 1}>
                    <strong>No Database Rows</strong>
                    <span className="text-xs text-slate-500">Try another search query or check the database source.</span>
                  </td>
                </tr>
              )}
              {visibleRows.map((row, index) => {
                const rowNumber = startIndex + index + 1;
                return (
                  <tr key={row.id ?? rowNumber}>
                    <td className="sticky-col index-col">{rowNumber}</td>
                    {fittedColumns.map((column) => (
                      <td key={column.key}>
                        <span className="database-cell" title={row[column.key] ?? ''}>{row[column.key] ?? ''}</span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          totalEntries={sortedRows.length}
          selectedCount={0}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
