import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Skeleton } from './Spinner'

// Thin table — the EAP recipe, not a grid engine (no sorting/paging state; add per project).
//   · table-layout: fixed + <colgroup> widths → columns don't jump while data loads
//   · under 720px it scrolls INSIDE .table-wrap with a min-width (`minWidth`), never the page
//     (measured at 390px in EAP: 52% of a table was unreachable without it)
//   · loading / error / empty rows are part of the table, so the layout never collapses
//   · numeric columns: align 'right' + tabular-nums

export type Column<T> = {
  key: string
  header: ReactNode
  /** CSS width for the <col>, e.g. '30%', '120px'. Leave one column without it to take the rest. */
  width?: string
  align?: 'left' | 'right' | 'center'
  /** Numbers/timestamps: tabular figures + right alignment. */
  numeric?: boolean
  /** One line with an ellipsis instead of wrapping. */
  clip?: boolean
  render: (row: T) => ReactNode
  /** Dim this info cell (never the whole row: action buttons must stay clearly actionable). */
  dim?: (row: T) => boolean
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  empty = 'Nothing here yet.',
  onRowClick,
  minWidth = 640,
  caption,
  className,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  /** Shown in place of rows (keep the table frame). */
  error?: ReactNode
  empty?: ReactNode
  onRowClick?: (row: T) => void
  /** Width the table keeps on a phone (it scrolls inside its wrapper below 720px). */
  minWidth?: number
  caption?: string
  className?: string
}) {
  const showSkeleton = loading && (!rows || rows.length === 0)
  const state = error ? (
    <span className="text-danger">{error}</span>
  ) : !showSkeleton && rows && rows.length === 0 ? (
    empty
  ) : null

  return (
    <div className={cx('table-wrap', className)} style={{ '--table-min': `${minWidth}px` } as CSSProperties} aria-busy={loading || undefined}>
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ textAlign: c.align ?? (c.numeric ? 'right' : 'left') }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state ? (
            <tr>
              <td className="table-state" colSpan={columns.length}>
                {state}
              </td>
            </tr>
          ) : showSkeleton ? (
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                {columns.map((c) => (
                  <td key={c.key}>
                    <Skeleton width={i === 1 ? '55%' : '75%'} />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            rows!.map((row) => (
              <tr
                key={rowKey(row)}
                data-clickable={onRowClick ? '' : undefined}
                onClick={
                  onRowClick
                    ? (e) => {
                        // Clicks on the row's own buttons/links/menus are theirs, not a row click.
                        if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [role=menu]')) return
                        onRowClick(row)
                      }
                    : undefined
                }
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(c.numeric && 'num', c.clip && 'clip', c.dim?.(row) && 'opacity-55')}
                    style={c.align || c.numeric ? { textAlign: c.align ?? 'right' } : undefined}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
