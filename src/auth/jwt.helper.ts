import { Request } from 'express';

export class JwtHelper {
    static extractTokenFromHeader(headers: Request['headers']): string | undefined {
        const [type, token] = headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
