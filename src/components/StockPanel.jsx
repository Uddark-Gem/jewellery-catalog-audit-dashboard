import { useEffect, useMemo, useState } from 'react';
import { STOCK_COLUMNS } from '../lib/tableConfig';
import CellInput from './CellInput';
import Pagination from './Pagination';
import { SearchIcon, XIcon, RotateCcwIcon, XIcon as RemoveIcon } from './Icons';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250];
const toText = (value) => String(value ?? '').trim();
const toSearchText = (value) => toText(value).toLowerCase();
const compareValues = (a, b) => toText(a).localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const getAutoColumnWidth = (column, sampleRows) => {
  const longestValue = sampleRows.reduce(
    (length, row) => Math.max(length, toText(row[column.key]).length),
    toText(column.label).length,
  );
  const contentWidth = longestValue * 7.2 + 42;
  const preferredWidth = Math.max(column.width ?? 96, contentWidth);
  return Math.round(Math.min(Math.max(preferredWidth, 80), 300));
};

export default function StockPanel({ mode, rows = [], onRowsChange }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState('');
  const density = 'compact';
  const [sort, setSort] = useState({ key: '', direction: 'asc' });

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => STOCK_COLUMNS.some((column) => toSearchText(row[column.key]).includes(query)));
  }, [rows, search]);

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
    () => STOCK_COLUMNS.map((column) => ({ ...column, width: getAutoColumnWidth(column, visibleRows) })),
    [visibleRows]
  );
  const tableMinWidth = useMemo(
    () => Math.max(760, fittedColumns.reduce((total, column) => total + column.width, 88)),
    [fittedColumns]
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sort]);

  const updateCell = async (id, field, value) => {
    onRowsChange((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    try {
      await fetch(`/api/data/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value })
      });
    } catch (error) {
      console.error('Failed to persist edit:', error);
    }
  };

  const removeRow = (id) => onRowsChange((prev) => prev.filter((row) => row.id !== id));

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: 'asc' };
    });
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="table-shell stock-table-shell">
        <div className="table-toolbar">
          <span className="badge">
            {mode === 'in' ? 'Out-of-stock SKUs' : 'In-stock SKUs'}
          </span>
          <div className="toolbar-search">
            <span className="toolbar-field-label">Search Inventory</span>
            <div className="toolbar-search-input-wrap">
              <SearchIcon className="search-icon w-4 h-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search inventory..."
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
          <table className="data-table interactive-table" style={{ width: tableMinWidth, minWidth: tableMinWidth }}>
            <thead>
              <tr>
                <th className="sticky-col index-col" style={{ width: 44 }}>#</th>
                {fittedColumns.map((column) => (
                  <th key={column.key} style={{ minWidth: column.width }}>
                    <button className="th-sort-button" type="button" onClick={() => toggleSort(column.key)}>
                      <span>{column.label}</span>
                      <span className="sort-indicator">{sort.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                ))}
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td className="empty-table-cell" colSpan={fittedColumns.length + 2}>
                    <strong>No Matching Stock Rows</strong>
                    <span className="text-xs text-slate-500">Adjust search criteria or synchronize the catalog.</span>
                  </td>
                </tr>
              )}
              {visibleRows.map((row, index) => {
                const rowNumber = startIndex + index + 1;
                return (
                  <tr key={row.id} className="group">
                    <td className="sticky-col index-col">{rowNumber}</td>
                    {fittedColumns.map((column) => (
                      <td key={column.key}>
                        <CellInput
                          className="cell-input"
                          value={row[column.key] || ''}
                          title={row[column.key] || ''}
                          placeholder={column.placeholder}
                          ariaLabel={column.label + ' for row ' + rowNumber}
                          onChange={(val) => updateCell(row.id, column.key, val)}
                        />
                      </td>
                    ))}
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={'Remove row ' + rowNumber}
                        title="Remove row"
                      >
                        <RemoveIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
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
