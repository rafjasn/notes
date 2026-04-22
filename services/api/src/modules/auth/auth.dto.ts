import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsOptional,
    IsPhoneNumber,
    IsString,
    Length,
    MaxLength,
    MinLength
} from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email!: string;
}

export class ResetPasswordDto {
    @ApiProperty({ description: 'Token from the password reset email' })
    @IsString()
    token!: string;

    @ApiProperty({ minLength: 8, maxLength: 128 })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    newPassword!: string;
}

export class ConfirmResetPasswordMfaDto {
    @ApiProperty()
    @IsString()
    challengeId!: string;

    @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
    @IsString()
    @Length(6, 6)
    code!: string;
}

export class UpdateProfileDto {
    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ example: '+12125550123' })
    @IsOptional()
    @IsPhoneNumber()
    phone?: string;
}

export class RegisterDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ minLength: 8, maxLength: 128 })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    password!: string;

    @ApiProperty({ example: 'Jane Smith' })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name!: string;
}

export class LoginDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ minLength: 8, maxLength: 128 })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    password!: string;

    @ApiPropertyOptional({
        description: 'Scope the session to a specific workspace',
        maxLength: 63
    })
    @IsOptional()
    @IsString()
    @MaxLength(63)
    workspaceSubdomain?: string;

    @ApiPropertyOptional({ maxLength: 63 })
    @IsOptional()
    @IsString()
    @MaxLength(63)
    workspaceSlug?: string;
}

export class RefreshDto {
    @ApiProperty()
    @IsString()
    refreshToken!: string;
}

export class InitiateEmailOtpDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email!: string;

    @ApiPropertyOptional({ maxLength: 63 })
    @IsOptional()
    @IsString()
    @MaxLength(63)
    workspaceSubdomain?: string;
}

export class VerifyOtpDto {
    @ApiProperty()
    @IsString()
    challengeId!: string;

    @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
    @IsString()
    @Length(6, 6)
    code!: string;
}

export class InitiateMagicLinkDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email!: string;

    @ApiPropertyOptional({ maxLength: 63 })
    @IsOptional()
    @IsString()
    @MaxLength(63)
    workspaceSubdomain?: string;
}

export class InitiateSmsOtpDto {
    @ApiProperty({ example: '+12125550123' })
    @IsPhoneNumber()
    phone!: string;

    @ApiPropertyOptional({ maxLength: 63 })
    @IsOptional()
    @IsString()
    @MaxLength(63)
    workspaceSubdomain?: string;
}

export class OAuthCallbackDto {
    @ApiProperty()
    @IsString()
    code!: string;

    @ApiProperty()
    @IsString()
    state!: string;
}

export class MfaChallengeDto {
    @ApiProperty()
    @IsString()
    challengeId!: string;

    @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
    @IsString()
    @Length(6, 6)
    code!: string;
}

export class EnableMfaDto {
    @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
    @IsString()
    @Length(6, 6)
    code!: string;
}
