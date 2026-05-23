import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      /** Calmer defaults — fewer surprise refetches; explicit `refetch()` stays available. */
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      /** Softer backoff on flaky networks (Render cold start, mobile). */
      retryDelay: (attempt) => Math.min(1200, 300 * 2 ** attempt),
    },
    mutations: {
      retry: 0,
    },
  },
})

if (typeof window !== 'undefined') {
  window.addEventListener('finklik:org-changed', () => {
    void queryClient.invalidateQueries()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
