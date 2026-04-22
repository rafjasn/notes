import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {
    transform(value: string): string {
        if (!OBJECT_ID_RE.test(value)) {
            throw new BadRequestException(`"${value}" is not a valid id`);
        }

        return value;
    }
}
