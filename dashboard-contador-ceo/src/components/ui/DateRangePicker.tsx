import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { useDateRange } from '@/context/DateRangeContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DatePreset } from '@/types/dashboard'

const presets: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'this_week', label: 'Esta semana' },
  { key: 'this_month', label: 'Este mês' },
  { key: 'this_quarter', label: 'Trimestre atual' },
  { key: 'this_year', label: 'Ano atual' },
  { key: 'custom', label: 'Personalizado' },
]

export function DateRangePicker() {
  const { preset, dateRange, setPreset, setCustomRange } = useDateRange()
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCustom(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLabel = preset === 'custom'
    ? `${format(dateRange.start, 'dd/MM', { locale: ptBR })} — ${format(dateRange.end, 'dd/MM', { locale: ptBR })}`
    : presets.find((p) => p.key === preset)?.label || 'Este mês'

  const handlePreset = (key: DatePreset) => {
    if (key === 'custom') {
      setShowCustom(true)
      return
    }
    setPreset(key)
    setOpen(false)
    setShowCustom(false)
  }

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      setCustomRange({
        start: new Date(customStart + 'T00:00:00'),
        end: new Date(customEnd + 'T23:59:59'),
      })
      setOpen(false)
      setShowCustom(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-sm text-text-muted hover:text-text-primary hover:border-primary/30 transition-all duration-200 cursor-pointer"
        aria-label="Selecionar período"
      >
        <Calendar size={14} />
        <span className="hidden sm:inline">{currentLabel}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {!showCustom ? (
            <div className="py-1.5">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-all duration-200 cursor-pointer
                    ${preset === p.key
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium text-text-primary">Período personalizado</p>
              <div>
                <label className="text-xs text-text-muted block mb-1">Data início</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Data fim</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm text-text-muted hover:bg-surface-2 transition-all duration-200 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  onClick={handleApplyCustom}
                  disabled={!customStart || !customEnd}
                  className="flex-1 px-3 py-2 rounded-xl text-sm bg-primary text-white font-medium hover:bg-primary-hover transition-all duration-200 disabled:opacity-50 cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
