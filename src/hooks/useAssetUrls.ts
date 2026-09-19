import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../lib/browserStorage'
import type { StoredAsset } from '../types/project'

export function useAssetUrls() {
  const [state, setState] = useState<{ assets: StoredAsset[]; urls: Record<string, string> }>({ assets: [], urls: {} })
  useEffect(() => {
    let urls: Record<string, string> = {}
    const subscription = liveQuery(() => db.assets.toArray()).subscribe(assets => {
      Object.values(urls).forEach(URL.revokeObjectURL)
      urls = Object.fromEntries(assets.map(a => [a.id, URL.createObjectURL(a.blob)]))
      setState({ assets, urls })
    })
    return () => { subscription.unsubscribe(); Object.values(urls).forEach(URL.revokeObjectURL) }
  }, [])
  return state
}
