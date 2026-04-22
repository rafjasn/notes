import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateNoteDto {
    @ApiPropertyOptional({
        description: 'Plaintext title (omit when using encrypted fields)',
        maxLength: 200
    })
    @ValidateIf((dto: CreateNoteDto) => dto.title !== undefined || !dto.encryptedTitle)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ description: 'KMS-encrypted title (base64)', maxLength: 8192 })
    @ValidateIf((dto: CreateNoteDto) => dto.encryptedTitle !== undefined || !dto.title)
    @IsString()
    @MinLength(1)
    @MaxLength(8192)
    encryptedTitle?: string;

    @ApiPropertyOptional({
        description: 'AES-GCM IV for the encrypted title (base64)',
        maxLength: 1024
    })
    @IsOptional()
    @IsString()
    @MaxLength(1024)
    titleIv?: string;

    @ApiPropertyOptional({ description: 'Plaintext or ciphertext note body' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ description: 'KMS-encrypted AES data key (base64)' })
    @IsOptional()
    @IsString()
    encryptedDataKey?: string;

    @ApiPropertyOptional({ description: 'AES-GCM IV for the note body (base64)', maxLength: 1024 })
    @IsOptional()
    @IsString()
    iv?: string;

    @ApiPropertyOptional({ description: 'True when title and content are KMS-encrypted' })
    @IsOptional()
    @IsBoolean()
    encrypted?: boolean;
}

export class UpdateNoteDto {
    @ApiPropertyOptional({ maxLength: 200 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({ description: 'KMS-encrypted title (base64)', maxLength: 8192 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(8192)
    encryptedTitle?: string;

    @ApiPropertyOptional({
        description: 'AES-GCM IV for the encrypted title (base64)',
        maxLength: 1024
    })
    @IsOptional()
    @IsString()
    @MaxLength(1024)
    titleIv?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ description: 'KMS-encrypted AES data key (base64)' })
    @IsOptional()
    @IsString()
    encryptedDataKey?: string;

    @ApiPropertyOptional({ description: 'AES-GCM IV for the note body (base64)', maxLength: 1024 })
    @IsOptional()
    @IsString()
    iv?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    encrypted?: boolean;
}
