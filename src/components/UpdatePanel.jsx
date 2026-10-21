import { useEffect, useMemo, useState } from 'react';
import CellInput from './CellInput';
import Pagination from './Pagination';
import { SearchIcon, XIcon, RotateCcwIcon, DownloadIcon } from './Icons';

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

export default function UpdatePanel({ columns, rows = [], onRowsChange, onExport }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState('');
  const density = 'compact';
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState([]);

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
    () => columns.map((column) => ({ ...column, width: getAutoColumnWidth(column, visibleRows) })),
    [columns, visibleRows]
  );
  const tableMinWidth = useMemo(
    () => Math.max(900, fittedColumns.reduce((total, column) => total + column.width, 146)),
    [fittedColumns]
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    const idSet = new Set(rows.map((row) => row.id));
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      return prev.filter((id) => idSet.has(id));
    });
  }, [rows]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sort]);

  const updateCell = (id, field, value) => {
    onRowsChange((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: '', direction: 'asc' };
    });
  };

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const toggleSelectVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleRows.some((row) => row.id === id));

      const selected = new Set(prev);
      visibleRows.forEach((row) => selected.add(row.id));
      return [...selected];
    });
  };
  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const resetControls = () => {
    setSearch('');
    setSort({ key: '', direction: 'asc' });
    setPageSize(100);
  };

  const hasActiveFilters = Boolean(search || sort.key);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="table-shell audit-table-shell">
        <div className="table-toolbar">
          <div className="toolbar-search">
            <span className="toolbar-field-label">Search Discrepancies</span>
            <div className="toolbar-search-input-wrap">
              <SearchIcon className="search-icon w-4 h-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by SKU, URL Key, status..."
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

          <div className="flex items-center gap-2.5 ml-auto">
            <button className="btn-ghost" type="button" onClick={resetControls} title="Reset filters">
              <RotateCcwIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
            <button className="btn-ghost" type="button" onClick={onExport} title="Export discrepancy CSV">
              <DownloadIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="active-filter-row">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Active Filters:</span>
          {search && (
            <button type="button" className="filter-chip chip-slate" onClick={() => setSearch('')}>
              Search: "{search}"
              <span aria-hidden="true">✕</span>
            </button>
          )}
          {sort.key && (
            <button type="button" className="filter-chip chip-slate" onClick={() => setSort({ key: '', direction: 'asc' })}>
              Sorted: {sort.key} ({sort.direction})
              <span aria-hidden="true">✕</span>
            </button>
          )}
          {!hasActiveFilters && <span className="text-slate-400 font-normal">None</span>}
          {hasActiveFilters && (
            <button type="button" className="clear-filter-button" onClick={resetControls}>
              Clear all
            </button>
          )}
        </div>

        <div className={'panel-card flex-1 min-h-0 overflow-auto density-' + density}>
          <table className="data-table interactive-table" style={{ width: tableMinWidth, minWidth: tableMinWidth }}>
            <thead>
              <tr>
                <th className="sticky-col select-col" style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectVisible}
                    aria-label="Select visible rows"
                  />
                </th>
                <th className="sticky-col index-col" style={{ width: 44, left: 40 }}>#</th>
                {fittedColumns.map((column) => (
                  <th
                    key={column.key}
                    style={{ minWidth: column.width }}
                    aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button className="th-sort-button" type="button" onClick={() => toggleSort(column.key)}>
                      <span>{column.label}</span>
                      <span className="sort-indicator">{sort.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td className="empty-table-cell" colSpan={fittedColumns.length + 2}>
                    <strong>No Discrepant SKUs Found</strong>
                    <span className="text-xs text-slate-500">All products match the reference standard or try another search query.</span>
                  </td>
                </tr>
              )}
              {visibleRows.map((row, index) => {
                const rowNumber = startIndex + index + 1;
                return (
                  <tr key={row.id}>
                    <td className="sticky-col select-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelectRow(row.id)}
                        aria-label={'Select row ' + rowNumber}
                      />
                    </td>
                    <td className="sticky-col index-col" style={{ left: 40 }}>{rowNumber}</td>
                    {fittedColumns.map((column) => (
                      <td key={column.key}>
                        <CellInput
                          className="cell-input"
                          value={row[column.key] || ''}
                          title={row[column.key] || ''}
                          placeholder={column.placeholder}
                          ariaLabel={column.label + ' for row ' + rowNumber}
                          readOnly={column.readOnly}
                          onChange={(val) => updateCell(row.id, column.key, val)}
                        />
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
          selectedCount={selectedIds.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
