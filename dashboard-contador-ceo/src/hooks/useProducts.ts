import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import type { ActiveProduct } from '@/types/database'
import { MOCK_ENABLED, MOCK_PRODUCTS } from '@/mocks/mockData'

export function useProducts() {
  const [products, setProducts] = useState<ActiveProduct[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (MOCK_ENABLED) {
      setProducts(MOCK_PRODUCTS)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('active_products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (data) setProducts(data as ActiveProduct[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { products, loading, reload: load }
}
