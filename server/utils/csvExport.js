/**
 * utils/csvExport.js — minimal, dependency-free CSV generation
 * (no need for a library for straightforward flat-row exports)
 */
function toCSV(rows, columns) {
  // columns: [{ key: 'username', label: 'Username' }, ...]
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Quote if it contains a comma, quote, or newline; double up any quotes inside
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const header = columns.map(c => escape(c.label)).join(',');
  const lines = rows.map(row =>
    columns.map(c => escape(typeof c.get === 'function' ? c.get(row) : row[c.key])).join(',')
  );
  return [header, ...lines].join('\r\n');
}

function sendCSV(res, filename, csvContent) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}

module.exports = { toCSV, sendCSV };
