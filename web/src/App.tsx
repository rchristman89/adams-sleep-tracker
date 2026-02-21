import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Status = 'OK' | 'DEGRADED' | 'MAJOR' | 'SEV1' | 'UNKNOWN'

type StatusEntry = {
  sleepDate: string
  status: Status
  minutesSlept: number | null
}

type BurnEntry = {
  sleepDate: string
  burn: number
  cumulativeBurn: number
}

type StatsResponse = {
  generatedAtUtc: string
  timezone: string
  sloMinutes: number
  endSleepDate: string
  averages: {
    avgMinutes7: number | null
    avgMinutes30: number | null
  }
  percentiles30: {
    p50Minutes: number | null
    p90Minutes: number | null
  }
  incidents30: {
    incidents: number
    sev1: number
  }
  reliability7: {
    availability: number
    errorBudget: number
    knownNights: number
  }
  statusHistory30: StatusEntry[]
  cumulativeBurnSeries: BurnEntry[]
}

const STATUS_COLORS: Record<Status, string> = {
  OK: '#16a34a',
  DEGRADED: '#f59e0b',
  MAJOR: '#f97316',
  SEV1: '#dc2626',
  UNKNOWN: '#94a3b8',
}

const formatMinutes = (minutes: number | null | undefined) => {
  if (minutes === null || minutes === undefined) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${mins}m`
}

const formatPct = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function App() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const response = await fetch('/api/stats')
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`)
        }
        const payload: StatsResponse = await response.json()
        if (mounted) {
          setStats(payload)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setStats(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const lastNight = useMemo(() => {
    if (!stats) return null
    const match = stats.statusHistory30.find(
      (entry) => entry.sleepDate === stats.endSleepDate,
    )
    return match ?? stats.statusHistory30.at(-1) ?? null
  }, [stats])

  const incidentLog = useMemo(() => {
    if (!stats) return []
    return [...stats.statusHistory30]
      .filter((entry) => entry.status !== 'OK' && entry.status !== 'UNKNOWN')
      .sort((a, b) => (a.sleepDate < b.sleepDate ? 1 : -1))
      .slice(0, 14)
  }, [stats])

  const history = stats?.statusHistory30 ?? []
  const burnSeries = stats?.cumulativeBurnSeries ?? []

  const burnByDate = useMemo(() => {
    const map = new Map<string, number>()
    burnSeries.forEach((entry) => map.set(entry.sleepDate, entry.cumulativeBurn))
    return map
  }, [burnSeries])

  const maxMinutes = useMemo(() => {
    if (!stats) return 0
    const values = stats.statusHistory30
      .map((entry) => entry.minutesSlept ?? 0)
      .filter((value) => value > 0)
    const maxValue = values.length ? Math.max(...values) : stats.sloMinutes
    return Math.max(maxValue, stats.sloMinutes)
  }, [stats])

  const maxBurn = useMemo(() => {
    const values = burnSeries.map((entry) => entry.cumulativeBurn)
    return values.length ? Math.max(...values) : 1
  }, [burnSeries])

  if (loading) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Sleep Reliability Dashboard</h1>
          <p>Loading latest stats…</p>
        </header>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Sleep Reliability Dashboard</h1>
        </header>
        <div className="panel error">
          <h2>Unable to load stats</h2>
          <p>{error ?? 'Unknown error'}</p>
          <p>Try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const lastNightStatus = lastNight?.status ?? 'UNKNOWN'

  const chartWidth = 1000
  const chartHeight = 220
  const barAreaHeight = 150
  const barWidth = history.length ? chartWidth / history.length : chartWidth
  const burnLinePoints = history.map((entry, index) => {
    const burn = burnByDate.get(entry.sleepDate) ?? 0
    const x = index * barWidth + barWidth / 2
    const y = barAreaHeight - (burn / maxBurn) * (barAreaHeight - 10) + 20
    return `${x},${y}`
  })

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Sleep Reliability Dashboard</h1>
          <p className="muted">
            Generated {new Date(stats.generatedAtUtc).toLocaleString()} • Timezone{' '}
            {stats.timezone}
          </p>
        </div>
        <div className={`status-banner status-${lastNightStatus.toLowerCase()}`}>
          <div>
            <span className="banner-label">Last night</span>
            <h2>{formatDate(lastNight?.sleepDate ?? stats.endSleepDate)}</h2>
          </div>
          <div>
            <span className="banner-label">Status</span>
            <strong>{lastNightStatus}</strong>
          </div>
          <div>
            <span className="banner-label">Sleep</span>
            <strong>{formatMinutes(lastNight?.minutesSlept ?? null)}</strong>
          </div>
        </div>
      </header>

      <section className="grid tiles">
        <div className="panel">
          <span className="panel-label">Availability (7d)</span>
          <h3>{formatPct(stats.reliability7.availability)}</h3>
          <p className="muted">Known nights: {stats.reliability7.knownNights}</p>
        </div>
        <div className="panel">
          <span className="panel-label">Error budget (7d)</span>
          <h3>{formatPct(stats.reliability7.errorBudget)}</h3>
          <p className="muted">Remaining budget</p>
        </div>
        <div className="panel">
          <span className="panel-label">Averages</span>
          <h3>{formatMinutes(stats.averages.avgMinutes7)}</h3>
          <p className="muted">7-day average</p>
          <p>{formatMinutes(stats.averages.avgMinutes30)} (30-day)</p>
        </div>
        <div className="panel">
          <span className="panel-label">Percentiles (30d)</span>
          <h3>{formatMinutes(stats.percentiles30.p50Minutes)}</h3>
          <p className="muted">P50 sleep duration</p>
          <p>{formatMinutes(stats.percentiles30.p90Minutes)} (P90)</p>
        </div>
        <div className="panel">
          <span className="panel-label">Incidents (30d)</span>
          <h3>{stats.incidents30.incidents}</h3>
          <p className="muted">SEV1 nights: {stats.incidents30.sev1}</p>
        </div>
      </section>

      <section className="panel history">
        <div className="panel-header">
          <h2>30-day status history</h2>
          <p className="muted">Squares represent nightly status.</p>
        </div>
        <div className="history-bar">
          {history.map((entry) => (
            <div
              key={entry.sleepDate}
              className="history-item"
              style={{ backgroundColor: STATUS_COLORS[entry.status] }}
              title={`${entry.sleepDate} • ${entry.status} • ${formatMinutes(entry.minutesSlept)}`}
            />
          ))}
        </div>
        <div className="history-legend">
          {(['OK', 'DEGRADED', 'MAJOR', 'SEV1', 'UNKNOWN'] as Status[]).map(
            (status) => (
              <span key={status} className="legend-item">
                <span
                  className="legend-color"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {status}
              </span>
            ),
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Daily sleep & burn</h2>
          <p className="muted">
            Bars show minutes slept. Line shows cumulative burn (below SLO).
          </p>
        </div>
        <div className="chart">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#0f172a" />
            <line
              x1="0"
              y1="20"
              x2={chartWidth}
              y2="20"
              stroke="#334155"
              strokeDasharray="4 6"
            />
            <line
              x1="0"
              y1={barAreaHeight + 20}
              x2={chartWidth}
              y2={barAreaHeight + 20}
              stroke="#1f2937"
            />
            {history.map((entry, index) => {
              const minutes = entry.minutesSlept ?? 0
              const barHeight = maxMinutes
                ? (minutes / maxMinutes) * barAreaHeight
                : 0
              const x = index * barWidth + barWidth * 0.1
              const y = barAreaHeight - barHeight + 20
              const width = barWidth * 0.8
              return (
                <rect
                  key={entry.sleepDate}
                  x={x}
                  y={y}
                  width={width}
                  height={barHeight}
                  fill={STATUS_COLORS[entry.status]}
                />
              )
            })}
            {burnLinePoints.length > 1 && (
              <polyline
                points={burnLinePoints.join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
              />
            )}
          </svg>
          <div className="chart-footer">
            <span>SLO: {formatMinutes(stats.sloMinutes)}</span>
            <span>Max sleep: {formatMinutes(maxMinutes)}</span>
            <span>Max burn: {maxBurn}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Incident log (last 14)</h2>
          <p className="muted">Nights below SLO or with degraded status.</p>
        </div>
        {incidentLog.length === 0 ? (
          <p className="muted">No incidents in the last 30 days.</p>
        ) : (
          <table className="incident-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Minutes slept</th>
              </tr>
            </thead>
            <tbody>
              {incidentLog.map((entry) => (
                <tr key={entry.sleepDate}>
                  <td>{formatDate(entry.sleepDate)}</td>
                  <td>
                    <span
                      className="status-pill"
                      style={{ backgroundColor: STATUS_COLORS[entry.status] }}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td>{formatMinutes(entry.minutesSlept)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default App
