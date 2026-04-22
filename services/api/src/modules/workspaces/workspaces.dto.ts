import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsEmail,
    IsIn,
    IsOptional,
    IsString,
    MaxLength,
    MinLength
} from 'class-validator';
import { PERMISSIONS } from './permissions.constants';

const ASSIGNABLE_PERMISSIONS = Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.all);

export class CreateWorkspaceDto {
    @ApiProperty({ example: 'Acme Corp', minLength: 1, maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name!: string;

    @ApiPropertyOptional({
        description: 'Custom subdomain slug (auto-generated from name if omitted)',
        minLength: 3,
        maxLength: 63,
        example: 'acme'
    })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(63)
    subdomain?: string;

    @ApiPropertyOptional({ description: 'Your display name inside this workspace', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    displayName?: string;
}

export class CreateRoleDto {
    @ApiProperty({ example: 'Editor', minLength: 1, maxLength: 80 })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    name!: string;

    @ApiPropertyOptional({ maxLength: 250 })
    @IsOptional()
    @IsString()
    @MaxLength(250)
    description?: string;

    @ApiProperty({
        description: 'Permissions to grant. Use notes:* for full access.',
        enum: ASSIGNABLE_PERMISSIONS,
        isArray: true
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsIn(ASSIGNABLE_PERMISSIONS, { each: true })
    permissions!: string[];
}

export class InviteUserDto {
    @ApiProperty({ example: 'colleague@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ description: 'Role IDs to assign on join', isArray: true, type: String })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsString({ each: true })
    roleIds!: string[];
}

export class UpdateMemberRolesDto {
    @ApiProperty({
        description: 'Complete replacement list of role IDs',
        isArray: true,
        type: String
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsString({ each: true })
    roleIds!: string[];
}

export class UpdateMyWorkspaceProfileDto {
    @ApiProperty({ example: 'Jane Smith', minLength: 1, maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    displayName!: string;
}

export class AcceptInvitationDto {
    @ApiPropertyOptional({ description: 'Override display name on join', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    displayName?: string;
}
