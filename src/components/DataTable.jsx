import React from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

/*
  禅道量化 · 古籍书表
  ─────────────────────────────────────
  只保留横线、不用竖线与边框。
  · 表头：细字大字距，下方细线
  · 行：   悬停浅墨晕
  · 数字： 西文衬线 Cormorant

  API 与原版完全相同：{ data, columns, rowClassName }
  columns[i]: { header, render, align?: 'text-left'|'text-right'|'text-center', sortKey?: string }
*/
const DataTable = ({ data, columns, rowClassName, sortConfig, onSort }) => (
  <div
    className="max-h-[500px] overflow-y-auto custom-scrollbar"
    style={{
      borderTop:    '1px solid var(--ink-3)',
      borderBottom: '1px solid var(--ink-4)',
      background: 'var(--paper-warm)',
    }}
  >
    <table className="book-table">
      <thead className="sticky top-0 z-10">
        <tr>
          {columns.map((col, i) => (
            <th 
                key={i} 
                className={`${col.align || 'text-left'} ${col.sortKey && onSort ? 'cursor-pointer hover:text-[var(--ink-dark)] selection:bg-transparent' : ''}`}
                onClick={() => col.sortKey && onSort && onSort(col.sortKey)}
            >
              <div className={`flex items-center gap-1 ${col.align === 'text-right' ? 'justify-end' : col.align === 'text-center' ? 'justify-center' : 'justify-start'}`}>
                {col.header}
                {col.sortKey && onSort && (
                  <span className="flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                    {sortConfig?.key === col.sortKey ? (
                      sortConfig.direction === 'asc' 
                        ? <ChevronUp size={14} style={{ color: 'var(--cinnabar)' }} /> 
                        : <ChevronDown size={14} style={{ color: 'var(--cinnabar)' }} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-30" />
                    )}
                  </span>
                )}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className="text-center empty-dash"
              style={{ padding: '48px 12px', letterSpacing: '0.25em' }}
            >
              ——  静  候  数  据  ——
            </td>
          </tr>
        ) : (
          data.map((row, idx) => (
            <tr
              key={row.originalIndex ?? idx}
              className={`tr-hover transition-colors ${rowClassName?.(row, idx) || ''}`}
            >
              {columns.map((col, i) => (
                <td key={i} className={col.align || 'text-left'}>
                  {col.render(row, idx)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export default DataTable;
