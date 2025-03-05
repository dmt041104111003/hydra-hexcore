import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { map, catchError } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class BaseResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Get the HTTP status code from the context
        const statusCode = context.switchToHttp().getResponse().statusCode;

        // Standardize the success response
        return {
          data,
          statusCode,
          message: 'Request successful',
          status: 'success',
        };
      }),
      catchError((err) => {
        console.log('>>> / file: base-response.interceptor.ts:22 / err:', err);

        // Catch and format the error response
        const statusCode = (err.status ||
          context.switchToHttp().getResponse().statusCode) as number;
        const errResponse = {
          data: null,
          statusCode,
          message: err?.response?.message || err.message || 'An error occurred',
          status: 'failure',
          ...(err.cause ? { cause: err.cause } : {}),
        };
        if (statusCode === 500) {
          throw new InternalServerErrorException();
        } else if (statusCode === 400) {
          throw new BadRequestException(errResponse);
        } else {
          throw new HttpException(errResponse.message, statusCode);
        }
      }),
    );
  }
}
