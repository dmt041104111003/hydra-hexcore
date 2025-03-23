import { IPaginationOptions } from 'src/interfaces/pagination.type';
import { InfinityPaginationResponseDto } from './dto/infinity-pagination-response.dto';

export const infinityPagination = <T>(data: T[], options: IPaginationOptions): InfinityPaginationResponseDto<T> => {
    return {
        data,
        hasNextPage: data.length === options.limit,
        page: options.page,
        limit: options.limit,
    };
};
