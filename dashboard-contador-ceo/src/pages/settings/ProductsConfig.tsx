import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import { callPiperunProxy } from '@/services/piperunProxy'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Package, RefreshCw, Check, AlertTriangle } from 'lucide-react'
import type { ActiveProduct, PiperunItemCache } from '@/types/database'
import type { PiperunItem } from '@/types/piperun'
import { MOCK_ENABLED, MOCK_PRODUCTS } from '@/mocks/mockData'

export default function ProductsConfig() {
  const { user } = useAuth()
  const [piperunItems, setPiperunItems] = useState<PiperunItemCache[]>([])
  const [activeProducts, setActiveProducts] = useState<ActiveProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load cached items + active products from Supabase
  const loadData = useCallback(async () => {
    if (MOCK_ENABLED) {
      const mockItems: PiperunItemCache[] = MOCK_PRODUCTS.map(p => ({
        id: p.id,
        piperun_item_id: p.piperun_item_id,
        name: p.name,
        price: p.name === 'Plano Pro' ? 1200 : 3500,
        data: {},
        synced_at: new Date().toISOString(),
      }))
      setPiperunItems(mockItems)
      setActiveProducts(MOCK_PRODUCTS)
      setLoading(false)
      return
    }
    setLoading(true)
    const [itemsRes, productsRes] = await Promise.all([
      supabase.from('piperun_items_cache').select('*').order('name'),
      supabase.from('active_products').select('*').order('name'),
    ])
    if (itemsRes.data) setPiperunItems(itemsRes.data as PiperunItemCache[])
    if (productsRes.data) setActiveProducts(productsRes.data as ActiveProduct[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Fetch fresh items from PipeRun via proxy
  const fetchFromPiperun = async () => {
    setFetching(true)
    setError(null)
    try {
      const response = await callPiperunProxy<PiperunItem>({ endpoint: '/items', params: { show: '200' } })
      const items = response.data || []

      if (items.length === 0) {
        setError('Nenhum produto encontrado no PipeRun.')
        setFetching(false)
        return
      }

      // Upsert into cache
      const rows = items.map((item) => ({
        piperun_item_id: item.id,
        name: item.name || `Produto #${item.id}`,
        price: item.price || 0,
        data: item as unknown as Record<string, unknown>,
        synced_at: new Date().toISOString(),
      }))

      await supabase.from('piperun_items_cache').upsert(rows, { onConflict: 'piperun_item_id' })
      await loadData()
    } catch (err) {
      setError(`Erro ao buscar produtos: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setFetching(false)
    }
  }

  // Toggle active status of a product
  const toggleProduct = async (item: PiperunItemCache) => {
    if (!user) return
    const existing = activeProducts.find(p => p.piperun_item_id === item.piperun_item_id)

    if (existing) {
      // Toggle is_active
      await supabase
        .from('active_products')
        .update({ is_active: !existing.is_active })
        .eq('id', existing.id)
    } else {
      // Create new active product
      await supabase.from('active_products').insert({
        piperun_item_id: item.piperun_item_id,
        name: item.name,
        is_active: true,
        created_by: user.id,
      })
    }

    await loadData()
  }

  const isProductActive = (piperunItemId: number) => {
    const p = activeProducts.find(ap => ap.piperun_item_id === piperunItemId)
    return p?.is_active ?? false
  }

  const activeCount = activeProducts.filter(p => p.is_active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-gold" />
          <h2 className="text-lg font-semibold text-text-primary">Configuração de Produtos</h2>
        </div>
        <Button onClick={fetchFromPiperun} disabled={fetching} variant="secondary" size="sm">
          <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
          {fetching ? 'Buscando...' : 'Buscar do PipeRun'}
        </Button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-center gap-2 text-sm text-danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Info */}
      <div className="bg-surface-2 rounded-xl p-4 text-sm text-text-muted">
        <p>
          Selecione os produtos que deseja rastrear no dashboard. Metas e KPIs serão filtráveis por produto.
          Deals sem produto vinculado serão classificados como "Sem Produto".
        </p>
        <p className="mt-1 font-medium text-text-primary">
          {activeCount} produto{activeCount !== 1 ? 's' : ''} ativo{activeCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Products list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : piperunItems.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Package size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum produto encontrado no cache.</p>
          <p className="text-xs mt-1">Clique em "Buscar do PipeRun" para carregar os produtos.</p>
        </div>
      ) : (
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
          {piperunItems.map((item) => {
            const active = isProductActive(item.piperun_item_id)
            return (
              <div
                key={item.piperun_item_id}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${active ? 'bg-success' : 'bg-text-faint'}`} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.name}</p>
                    {item.price != null && item.price > 0 && (
                      <p className="text-xs text-text-muted">
                        R$ {Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleProduct(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer
                    ${active
                      ? 'bg-success/10 text-success hover:bg-success/20'
                      : 'bg-surface-2 text-text-muted hover:bg-surface-2/80'
                    }`}
                >
                  {active ? (
                    <span className="flex items-center gap-1"><Check size={12} /> Ativo</span>
                  ) : (
                    'Ativar'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Fixed "Sem Produto" category */}
      <div className="bg-surface rounded-xl border border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-text-faint" />
            <div>
              <p className="text-sm font-medium text-text-muted">Sem Produto</p>
              <p className="text-xs text-text-faint">Deals sem produto vinculado no PipeRun</p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-2 text-text-faint">
            Sempre ativo
          </span>
        </div>
      </div>
    </div>
  )
}
