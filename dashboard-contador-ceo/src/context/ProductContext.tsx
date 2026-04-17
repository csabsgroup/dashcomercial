import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/services/supabase'
import type { ActiveProduct } from '@/types/database'
import { MOCK_ENABLED, MOCK_PRODUCTS } from '@/mocks/mockData'

export const NO_PRODUCT_ID = '__no_product__'

interface ProductContextType {
  selectedProductId: string | null // null = todos, NO_PRODUCT_ID = sem produto, uuid = produto específico
  setSelectedProductId: (id: string | null) => void
  activeProducts: ActiveProduct[]
  loading: boolean
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export function ProductProvider({ children }: { children: ReactNode }) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [activeProducts, setActiveProducts] = useState<ActiveProduct[]>([])
  const [loading, setLoading] = useState(true)

  const loadProducts = useCallback(async () => {
    if (MOCK_ENABLED) {
      setActiveProducts(MOCK_PRODUCTS)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('active_products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (data) setActiveProducts(data as ActiveProduct[])
    setLoading(false)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  // Listen for realtime changes to active_products
  useEffect(() => {
    const channel = supabase
      .channel('active_products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_products' }, () => {
        loadProducts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadProducts])

  return (
    <ProductContext.Provider value={{ selectedProductId, setSelectedProductId, activeProducts, loading }}>
      {children}
    </ProductContext.Provider>
  )
}

export function useProductFilter() {
  const ctx = useContext(ProductContext)
  if (!ctx) throw new Error('useProductFilter must be used within ProductProvider')
  return ctx
}
