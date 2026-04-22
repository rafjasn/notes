export const RESERVED_WORKSPACE_SUBDOMAINS = new Set([
    'admin',
    'api',
    'app',
    'assets',
    'auth',
    'billing',
    'cdn',
    'cognito',
    'dashboard',
    'dev',
    'docs',
    'fanout',
    'health',
    'help',
    'invite',
    'invitations',
    'keycloak',
    'local',
    'localhost',
    'login',
    'logout',
    'mail',
    'metrics',
    'mongo',
    'nginx',
    'production',
    'prod',
    'register',
    'settings',
    'signup',
    'smtp',
    'socket',
    'static',
    'status',
    'staging',
    'support',
    'test',
    'websocket',
    'www',
    'ws'
]);

export function normalizeWorkspaceSubdomain(input: string): string {
    return input
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export function isReservedWorkspaceSubdomain(subdomain: string): boolean {
    return RESERVED_WORKSPACE_SUBDOMAINS.has(subdomain);
}

export function workspaceSubdomainValidationError(subdomain: string): string | null {
    if (!subdomain) return 'Workspace subdomain is required';
    if (subdomain.length < 3) return 'Workspace subdomain must be at least 3 characters';
    if (subdomain.length > 63) return 'Workspace subdomain must be at most 63 characters';
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
        return 'Workspace subdomain may only contain lowercase letters, numbers, and hyphens';
    }
    if (isReservedWorkspaceSubdomain(subdomain)) return 'Workspace subdomain is reserved';

    return null;
}

export function generatedWorkspaceSubdomainBase(input: string): string {
    let base = normalizeWorkspaceSubdomain(input);
    if (!base) base = 'workspace';
    if (base.length > 63) base = trimSubdomainBase(base, 63);
    if (base.length < 3) base = `${base}-co`;
    if (isReservedWorkspaceSubdomain(base)) base = `${base}-workspace`;
    if (base.length > 63) base = trimSubdomainBase(base, 63);

    return base;
}

export function appendWorkspaceSubdomainSuffix(base: string, suffix: number): string {
    const suffixText = `-${suffix}`;
    return `${trimSubdomainBase(base, 63 - suffixText.length)}${suffixText}`;
}

function trimSubdomainBase(base: string, maxLength: number): string {
    return base.slice(0, maxLength).replace(/-+$/g, '') || 'workspace';
}
