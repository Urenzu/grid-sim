import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:       4 * 60 * 1000,  // serve from cache for 4 min
      gcTime:         10 * 60 * 1000,  // keep in cache 10 min after unmount
      refetchInterval: 5 * 60 * 1000,  // background refetch every 5 min
      retry: 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
