'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: 1,
                        staleTime: 30 * 1000,
                        refetchOnWindowFocus: false
                    }
                }
            })
    );

    return (
        <ThemeProvider>
            <SidebarProvider>
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </SidebarProvider>
        </ThemeProvider>
    );
}
