import { Body, Controller, Delete, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
    ConfirmResetPasswordMfaDto,
    EnableMfaDto,
    ForgotPasswordDto,
    InitiateEmailOtpDto,
    InitiateMagicLinkDto,
    InitiateSmsOtpDto,
    LoginDto,
    MfaChallengeDto,
    OAuthCallbackDto,
    RefreshDto,
    RegisterDto,
    ResetPasswordDto,
    UpdateProfileDto,
    VerifyOtpDto
} from './auth.dto';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    register(@Body() dto: RegisterDto) {
        return this.auth.register(dto);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login with email and password' })
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto);
    }

    @Post('refresh')
    @ApiOperation({ summary: 'Refresh access token' })
    refresh(@Body() dto: RefreshDto) {
        return this.auth.refresh(dto.refreshToken);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    me(@CurrentUser() user: JwtUser) {
        return this.auth.me(user);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update current user profile' })
    updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
        return this.auth.updateProfile(user, dto);
    }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Request a password reset email' })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        await this.auth.forgotPassword(dto.email);
        return { sent: true };
    }

    @Post('reset-password')
    @ApiOperation({ summary: 'Reset password with token from email' })
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.auth.resetPassword(dto.token, dto.newPassword);
    }

    @Post('reset-password/mfa')
    @ApiOperation({ summary: 'Confirm password reset with MFA code' })
    confirmResetPasswordMfa(@Body() dto: ConfirmResetPasswordMfaDto) {
        return this.auth.confirmResetPasswordMfa(dto.challengeId, dto.code);
    }

    @Post('otp/email')
    @ApiOperation({ summary: 'Initiate email OTP login' })
    initiateEmailOtp(@Body() dto: InitiateEmailOtpDto) {
        return this.auth.initiateEmailOtp(dto.email, dto.workspaceSubdomain);
    }

    @Post('otp/email/verify')
    @ApiOperation({ summary: 'Verify email OTP code' })
    verifyEmailOtp(@Body() dto: VerifyOtpDto) {
        return this.auth.verifyEmailOtp(dto.challengeId, dto.code);
    }

    @Post('magic-link')
    @ApiOperation({ summary: 'Send a magic link login email' })
    async initiateMagicLink(@Body() dto: InitiateMagicLinkDto) {
        await this.auth.initiateMagicLink(dto.email, dto.workspaceSubdomain);
        return { sent: true };
    }

    @Get('magic-link/verify')
    @ApiOperation({ summary: 'Verify magic link token (redirect target)' })
    verifyMagicLink(@Query('token') token: string) {
        return this.auth.verifyMagicLink(token);
    }

    @Post('otp/sms')
    @ApiOperation({ summary: 'Initiate SMS OTP login' })
    initiateSmsOtp(@Body() dto: InitiateSmsOtpDto) {
        return this.auth.initiateSmsOtp(dto.phone, dto.workspaceSubdomain);
    }

    @Post('otp/sms/verify')
    @ApiOperation({ summary: 'Verify SMS OTP code' })
    verifySmsOtp(@Body() dto: VerifyOtpDto) {
        return this.auth.verifySmsOtp(dto.challengeId, dto.code);
    }

    @Get('oauth/url')
    @ApiOperation({ summary: 'Get OAuth provider authorization URL' })
    getOAuthUrl(@Query('redirectUri') redirectUri: string) {
        return this.auth.getOAuthUrl(redirectUri);
    }

    @Post('oauth/callback')
    @ApiOperation({ summary: 'Handle OAuth provider callback' })
    handleOAuthCallback(@Body() dto: OAuthCallbackDto, @Query('redirectUri') redirectUri: string) {
        return this.auth.handleOAuthCallback(dto.code, dto.state, redirectUri);
    }

    @Post('mfa/challenge')
    @ApiOperation({ summary: 'Verify an MFA challenge code' })
    verifyMfaChallenge(@Body() dto: MfaChallengeDto) {
        return this.auth.verifyMfaChallenge(dto.challengeId, dto.code);
    }

    @Post('mfa/setup')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Begin MFA setup (returns TOTP secret)' })
    setupMfa(@CurrentUser() user: JwtUser) {
        return this.auth.setupMfa(user);
    }

    @Post('mfa/enable')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Enable MFA after confirming TOTP code' })
    enableMfa(@CurrentUser() user: JwtUser, @Body() dto: EnableMfaDto) {
        return this.auth.enableMfa(user, dto.code);
    }

    @Delete('mfa')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Disable MFA for the current user' })
    disableMfa(@CurrentUser() user: JwtUser) {
        return this.auth.disableMfa(user);
    }
}
