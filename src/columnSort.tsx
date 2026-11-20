import React from 'react';

export type SortDir = 'asc' | 'desc';
export type ColumnSort = { field: string; dir: SortDir };

export function toggleColumnSort(cur: ColumnSort, field: string, firstDir: SortDir = 'asc'): ColumnSort {
  if (cur.field === field) return { field, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
  return { field, dir: firstDir };
}

export function columnSortMark(cur: ColumnSort, field: string) {
  if (cur.field !== field) return ' ↕';
  return cur.dir === 'asc' ? ' ↑' : ' ↓';
}

export function sortByColumn<T>(
  rows: T[],
  sort: ColumnSort,
  getters: Record<string, (row: T) => string | number>
): T[] {
  const get = getters[sort.field];
  if (!get) return rows;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'tr', { numeric: true, sensitivity: 'base' });
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

export function SortTh({
  label,
  field,
  sort,
  onSort,
  align = 'left',
  firstDir = 'asc',
  className = ''
}: {
  label: string;
  field: string;
  sort: ColumnSort;
  onSort: (next: ColumnSort) => void;
  align?: 'left' | 'right' | 'center';
  firstDir?: SortDir;
  className?: string;
}) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
  return (
    <th
      className={`py-2 px-3 cursor-pointer select-none hover:text-blue-600 ${alignCls} ${className}`.trim()}
      onClick={() => onSort(toggleColumnSort(sort, field, firstDir))}
    >
      {label}{columnSortMark(sort, field)}
    </th>
  );
}
