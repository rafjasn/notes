import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'Encrypted Notes',
    description: 'Multi-workspace encrypted notes workspace'
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full antialiased">
            <body className="min-h-full">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
