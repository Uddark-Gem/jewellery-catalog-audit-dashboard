import { useEffect, useMemo, useState, useRef } from 'react';
import CellInput from './CellInput';
import Pagination from './Pagination';
import {
  SearchIcon,
  XIcon,
  ColumnsIcon,
  RotateCcwIcon,
  DownloadIcon,
  RefreshCwIcon,
  ChevronDownIcon
} from './Icons';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250];
const toText = (value) => String(value ?? '').trim();

const uniqueOptions = (rows, key) => {
  if (!rows || !rows.length) return [];
  const set = new Set();
  const limit = Math.min(rows.length, 5000);
  for (let i = 0; i < limit; i++) {
    const val = toText(rows[i]?.[key]);
    if (val) set.add(val);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
};

const getAutoColumnWidth = (column, sampleRows) => {
  const longestValue = sampleRows.reduce(
    (length, row) => Math.max(length, toText(row[column.key]).length),
    toText(column.label).length,
  );
  const contentWidth = longestValue * 7.2 + 42;
  const preferredWidth = Math.max(column.width ?? 96, contentWidth);
  return Math.round(Math.min(Math.max(preferredWidth, 80), 300));
};

export default function ReportTable({ columns, rows = [], onRowsChange, onExport, onRefresh, isRefreshing = false }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState('');
  const [attributeSet, setAttributeSet] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const density = 'compact';
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [visibleKeys, setVisibleKeys] = useState(() => columns.map((column) => column.key));
  const [selectedIds, setSelectedIds] = useState([]);

  const containerRef = useRef(null);
  const lastColumnsKeyRef = useRef('');

  useEffect(() => {
    const keys = columns.map((column) => column.key);
    const keySig = keys.join(',');
    if (keySig !== lastColumnsKeyRef.current) {
      lastColumnsKeyRef.current = keySig;
      setVisibleKeys(keys);
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
        containerRef.current.scrollTop = 0;
      }
    }
  }, [columns]);

  const visibleColumns = useMemo(
    () => columns.filter((column) => visibleKeys.includes(column.key)),
    [columns, visibleKeys],
  );
  const attributeOptions = useMemo(() => uniqueOptions(rows, 'attribute_set_id'), [rows]);
  const statusOptions = useMemo(() => uniqueOptions(rows, 'status'), [rows]);

  const workerRef = useRef(null);
  const lastRowsRef = useRef(null);
  const [sortedRows, setSortedRows] = useState(() => rows || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const queryRef = useRef({ columns, search: debouncedSearch, attributeSet, statusFilter, stockFilter, sort });
  queryRef.current = { columns, search: debouncedSearch, attributeSet, statusFilter, stockFilter, sort };

  // Initialize Web Worker once
  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/auditWorker.js', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'FILTERED_ROWS' && data.sortedRows) {
        setSortedRows(data.sortedRows);
        setIsProcessing(false);
      } else if (data.sortedRows) {
        setSortedRows(data.sortedRows);
        setIsProcessing(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Post data to worker when rows load or query filters change
  useEffect(() => {
    if (!workerRef.current) return;
    if (!rows.length) {
      setSortedRows([]);
      setIsProcessing(false);
      return;
    }

    if (rows !== lastRowsRef.current) {
      lastRowsRef.current = rows;
      // Immediate 0ms first render if no filters active
      if (!debouncedSearch && !attributeSet && !statusFilter && !stockFilter && !sort.key) {
        setSortedRows(rows);
      }
      workerRef.current.postMessage({ action: 'INIT_DATA', rows });
    }

    setIsProcessing(true);
    workerRef.current.postMessage({
      action: 'FILTER_SORT',
      columns,
      search: debouncedSearch,
      attributeSet,
      statusFilter,
      stockFilter,
      sort,
      messageId: Date.now()
    });
  }, [rows, debouncedSearch, attributeSet, statusFilter, stockFilter, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const visibleRows = useMemo(() => sortedRows.slice(startIndex, startIndex + pageSize), [sortedRows, startIndex, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setSelectedIds([]);
  }, [rows]);

  useEffect(() => {
    setPage(1);
  }, [search, attributeSet, statusFilter, pageSize, sort]);

  const updateCell = async (id, field, value) => {
    setSortedRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
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

  const getRowClass = (row) => {
    let classes = 'group ';
    classes += row.status?.toLowerCase() === 'disabled' ? 'bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-300 ' : '';
    const isOut =
      row.is_in_stock === '0' ||
      row.is_in_stock === 0 ||
      String(row.is_in_stock ?? '').toLowerCase() === 'out of stock' ||
      row.qty === '0' ||
      row.qty === 0 ||
      parseFloat(String(row.qty ?? '0')) <= 0;
    classes += isOut ? 'border-l-3 border-l-amber-500 ' : 'border-l-3 border-l-transparent ';
    return classes;
  };

  const getCellClass = (row) => 'cell-input ' + (row.status?.toLowerCase() === 'disabled' ? 'text-red-800 dark:text-red-400 font-medium ' : '');

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key, direction: 'asc' };
    });
  };

  const toggleColumn = (key) => {
    setVisibleKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
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
    setAttributeSet('');
    setStatusFilter('');
    setStockFilter('');
    setSort({ key: '', direction: 'asc' });
    setPageSize(100);
    setVisibleKeys(columns.map((column) => column.key));
  };

  const hasActiveFilters = Boolean(search || attributeSet || statusFilter || stockFilter || sort.key);
  const fittedColumns = useMemo(
    () => visibleColumns.map((column) => ({ ...column, width: getAutoColumnWidth(column, visibleRows) })),
    [visibleColumns, visibleRows]
  );
  const tableMinWidth = useMemo(
    () => Math.max(1100, fittedColumns.reduce((total, column) => total + column.width, 146)),
    [fittedColumns]
  );

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="table-shell">
        {/* Search & Filter Toolbar */}
        <div className="table-toolbar">
          <div className="toolbar-search">
            <span className="toolbar-field-label">Search</span>
            <div className="toolbar-search-input-wrap">
              <SearchIcon className="search-icon w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by SKU, Name, URL Key..."
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

          <div className="toolbar-field">
            <span className="toolbar-field-label">Attribute Set</span>
            <select value={attributeSet} onChange={(event) => setAttributeSet(event.target.value)}>
              <option value="">All</option>
              {attributeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-field">
            <span className="toolbar-field-label">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-field">
            <span className="toolbar-field-label">Stock</span>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
              <option value="">All</option>
              <option value="in">In Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            <details className="column-menu">
              <summary>
                <ColumnsIcon className="w-4 h-4 text-slate-500" />
                <span>Columns</span>
                <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />
              </summary>
              <div className="column-menu-panel">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">Toggle Columns</p>
                {columns.map((column) => (
                  <label key={column.key}>
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={visibleKeys.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </details>

            <button className="btn-ghost" type="button" onClick={resetControls} title="Reset filters">
              <RotateCcwIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>

            <button className="btn-ghost" type="button" onClick={onExport} title="Export filtered rows as CSV">
              <DownloadIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>

            <button
              className="btn-primary"
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh catalog data"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {isProcessing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold px-2 py-1 bg-blue-50 dark:bg-blue-950/40 rounded-md">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Filtering...
              </span>
            )}
          </div>
        </div>

        {/* Active Filters Row */}
        <div className="active-filter-row">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Active Filters:</span>
          {attributeSet && (
            <button type="button" className="filter-chip chip-blue" onClick={() => setAttributeSet('')}>
              Attribute Set: {attributeSet}
              <span aria-hidden="true">✕</span>
            </button>
          )}
          {statusFilter && (
            <button type="button" className="filter-chip chip-green" onClick={() => setStatusFilter('')}>
              Status: {statusFilter}
              <span aria-hidden="true">✕</span>
            </button>
          )}
          {stockFilter && (
            <button type="button" className="filter-chip chip-amber" onClick={() => setStockFilter('')}>
              Stock: {stockFilter === 'in' ? 'In Stock' : 'Out of Stock'}
              <span aria-hidden="true">✕</span>
            </button>
          )}
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

        {/* Interactive Data Table */}
        <div ref={containerRef} className={'panel-card flex-1 min-h-0 overflow-auto density-' + density}>
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
                      <span className="sort-indicator">
                        {sort.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td className="empty-table-cell" colSpan={fittedColumns.length + 2}>
                    <strong>No Products Found</strong>
                    <span className="text-xs text-slate-500">Try adjusting your search criteria or resetting active filters.</span>
                  </td>
                </tr>
              )}
              {visibleRows.map((row, index) => {
                const rowNumber = startIndex + index + 1;
                return (
                  <tr key={row.id} className={getRowClass(row)}>
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
                        {column.render ? (
                          column.render(row, row[column.key], (val) => updateCell(row.id, column.key, val))
                        ) : column.key === 'product_url' ? (
                          <div className="flex items-center gap-1.5 px-1">
                            <CellInput
                              className={getCellClass(row)}
                              value={row[column.key] || ''}
                              title={row[column.key] || ''}
                              placeholder={column.placeholder}
                              ariaLabel={column.label + ' for row ' + rowNumber}
                              onChange={(val) => updateCell(row.id, column.key, val)}
                            />
                            {row[column.key] ? (
                              <a
                                href={row[column.key]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-0.5 text-xs font-bold inline-flex items-center shrink-0"
                                title="Open link in new tab"
                                onClick={(e) => e.stopPropagation()}
                              >
                                ↗
                              </a>
                            ) : null}
                          </div>
                        ) : (
                          <CellInput
                            className={getCellClass(row)}
                            value={row[column.key] || ''}
                            title={row[column.key] || ''}
                            placeholder={column.placeholder}
                            ariaLabel={column.label + ' for row ' + rowNumber}
                            onChange={(val) => updateCell(row.id, column.key, val)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Standard Numbered Pagination Footer */}
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
