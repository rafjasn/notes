import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '../auth-provider.interface';
import { CognitoProvider } from './cognito.provider';
import { KeycloakProvider } from './keycloak.provider';

export const AUTH_PROVIDER = 'AUTH_PROVIDER_TOKEN';

export const AuthProviderFactory: Provider = {
    provide: AUTH_PROVIDER,
    inject: [ConfigService],
    useFactory: (config: ConfigService): AuthProvider => {
        const provider = config.get<string>('app.auth.provider', 'keycloak');

        return provider === 'cognito' ? new CognitoProvider(config) : new KeycloakProvider(config);
    }
};
