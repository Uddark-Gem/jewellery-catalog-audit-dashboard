const toText = (value) => String(value ?? '').trim();
const toSearchText = (value) => toText(value).toLowerCase();
const parseNumber = (value) => Number.parseFloat(toText(value).replaceAll(',', ''));

const compareValues = (a, b) => {
  const aNumber = parseNumber(a);
  const bNumber = parseNumber(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
  return toText(a).localeCompare(toText(b), undefined, { numeric: true, sensitivity: 'base' });
};

let cachedRows = [];

const filterAndSort = (rows, columns, search = '', attributeSet = '', statusFilter = '', stockFilter = '', sort = {}) => {
  const query = search.trim().toLowerCase();
  
  const filteredRows = rows.filter((row) => {
    if (attributeSet && toText(row.attribute_set_id) !== attributeSet) return false;
    if (statusFilter && toText(row.status) !== statusFilter) return false;

    if (stockFilter) {
      const isOut =
        toText(row.is_in_stock) === '0' ||
        toText(row.is_in_stock).toLowerCase() === 'out of stock' ||
        toText(row.is_in_stock).toLowerCase() === 'no' ||
        parseFloat(toText(row.qty) || '0') <= 0;

      if (stockFilter === 'in' && isOut) return false;
      if (stockFilter === 'out' && !isOut) return false;
    }

    if (!query) return true;
    return columns.some((column) => toSearchText(row[column.key]).includes(query));
  });

  let sortedRows = filteredRows;
  if (sort && sort.key) {
    sortedRows = [...filteredRows].sort((a, b) => {
      const result = compareValues(a[sort.key], b[sort.key]);
      return sort.direction === 'asc' ? result : -result;
    });
  }

  return sortedRows;
};

self.onmessage = (event) => {
  const data = event.data || {};
  const { action, rows, columns, search, attributeSet, statusFilter, stockFilter, sort, messageId } = data;

  if (action === 'INIT_DATA') {
    cachedRows = rows || [];
    return;
  }

  if (action === 'FILTER_SORT') {
    const activeRows = rows || cachedRows;
    const sortedRows = filterAndSort(activeRows, columns, search, attributeSet, statusFilter, stockFilter, sort);
    self.postMessage({ type: 'FILTERED_ROWS', sortedRows, messageId });
    return;
  }

  // Fallback for direct post without action
  if (rows) {
    cachedRows = rows;
  }
  const sortedRows = filterAndSort(cachedRows, columns, search, attributeSet, statusFilter, stockFilter, sort);
  self.postMessage({ sortedRows, messageId });
};
