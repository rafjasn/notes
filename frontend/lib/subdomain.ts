const RESERVED_SUBDOMAINS = new Set([
    'admin',
    'api',
    'app',
    'auth',
    'docs',
    'login',
    'mail',
    'register',
    'static',
    'status',
    'support',
    'www'
]);

function hostWithoutPort(host: string) {
    return host.split(':')[0].toLowerCase();
}

function configuredRootHost() {
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    return root ? hostWithoutPort(root) : null;
}

export function getTenantSubdomainFromHostname(hostname: string) {
    const host = hostWithoutPort(hostname);
    const configuredRoot = configuredRootHost();

    if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        return null;
    }

    if (configuredRoot && (host === configuredRoot || host.endsWith(`.${configuredRoot}`))) {
        const prefix = host === configuredRoot ? '' : host.slice(0, -configuredRoot.length - 1);
        const subdomain = prefix.split('.').at(-1);

        return subdomain && !RESERVED_SUBDOMAINS.has(subdomain) ? subdomain : null;
    }

    const parts = host.split('.');

    if (parts.length === 2 && parts[1] === 'localhost') {
        return RESERVED_SUBDOMAINS.has(parts[0]) ? null : parts[0];
    }

    if (parts.length > 2) {
        return RESERVED_SUBDOMAINS.has(parts[0]) ? null : parts[0];
    }

    return null;
}

export function getTenantSubdomain() {
    if (typeof window === 'undefined') return null;
    return getTenantSubdomainFromHostname(window.location.hostname);
}

function rootHostname() {
    if (typeof window === 'undefined') {
        return configuredRootHost() ?? 'localhost';
    }

    const configuredRoot = configuredRootHost();

    if (configuredRoot) {
        return configuredRoot;
    }

    const host = window.location.hostname.toLowerCase();
    const subdomain = getTenantSubdomainFromHostname(host);

    if (!subdomain) {
        return host;
    }

    return host.split('.').slice(1).join('.');
}

export function workspaceUrl(subdomain: string) {
    if (typeof window === 'undefined') {
        return `http://${subdomain}.${rootHostname()}`;
    }

    const port = window.location.port ? `:${window.location.port}` : '';

    return `${window.location.protocol}//${subdomain}.${rootHostname()}${port}`;
}

export function hubUrl() {
    if (typeof window === 'undefined') {
        return `http://${rootHostname()}`;
    }

    const port = window.location.port ? `:${window.location.port}` : '';

    return `${window.location.protocol}//${rootHostname()}${port}`;
}
