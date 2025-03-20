import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class AuthSocketMessageGuard implements CanActivate {
    //   constructor(private authRoomService: AuthRoomService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const headers = context.switchToWs().getClient().handshake.headers;
        const data = context.switchToWs().getData();

        if (!this.isValidMessage(data)) {
            throw new WsException('Invalid message data');
        }

        // const dataValidate = await this.authRoomService.validate(data.access_token);
        // if (!dataValidate.status) {
        //   console.log('dataValidate', dataValidate);
        //   return false;
        // }
        // data.room = dataValidate.room;
        // data.user = dataValidate.user;
        // data.permissions = {
        //   canRead: dataValidate.canRead,
        //   canCreate: dataValidate.canCreate,
        //   canEdit: dataValidate.canEdit,
        //   canDelete: dataValidate.canDelete,
        // };
        data.test = 'test';
        const modifiedData = { ...data };

        console.log('[data] ', data, ', modifiedData ', modifiedData);

        context.switchToWs().getData = () => modifiedData;

        return true;
    }

    isValidMessage(data: Record<string, any>): boolean {
        return !!data.accessToken;
    }
}
