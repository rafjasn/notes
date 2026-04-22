import { IsString, MaxLength } from 'class-validator';

export class AuthorizeChannelDto {
    @IsString()
    @MaxLength(250)
    channel!: string;
}
