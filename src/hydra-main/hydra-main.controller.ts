import {
    BadRequestException,
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { HydraMainService } from './hydra-main.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { validateMnemonic } from 'bip39';
import { CreatePartyDto } from './dto/create-party.dto';
import { CreateHydraNodeDto } from './dto/create-hydra-node.dto';
import { ReqActivePartyDto } from './dto/request/active-party.dto';
import { CommitHydraDto } from './dto/request/commit-hydra.dto';
import { SubmitTxHydraDto } from './dto/request/submit-tx-hydra.dto';
import { QueryHydraDto } from './dto/query-hydra.dto';
import { infinityPagination } from 'src/utils/infinity-pagination';
import { InfinityPaginationResponseDto } from 'src/utils/dto/infinity-pagination-response.dto';
import { HydraDto } from './dto/hydra.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtService } from '@nestjs/jwt';
import { HydraAdminService } from './hydra-admin.service';
import { AdminAuthGuard } from 'src/auth/admin-auth.guard';
import { ReqClearPartyDataDto } from './dto/request/clear-party-data.dto';

@Controller('hydra-main')
export class HydraMainController {
    constructor(
        private hydraMainService: HydraMainService,
        private jwtService: JwtService,
        private hydraAdminService: HydraAdminService,
    ) {}

    @Get('request-node')
    requestHydraNode() {
        return 'This route uses a wildcard';
    }

    @Get('node-info')
    getCardanoNodeInfo() {
        return this.hydraMainService.getCardanoNodeInfo();
    }

    @Post('login')
    async login(@Body() loginDto: AdminLoginDto) {
        const user = await this.hydraAdminService.login(loginDto);
        return user;
    }

    @UseGuards(AdminAuthGuard)
    @UseInterceptors(ClassSerializerInterceptor)
    @Get('auth')
    async auth(@Req() req: any) {
        const user = await this.hydraAdminService.auth(req.user.id);
        return user;
    }

    @UseGuards(AdminAuthGuard)
    @UseInterceptors(ClassSerializerInterceptor)
    @Get('list-account')
    getListAccount() {
        return this.hydraMainService.getListAccount();
    }

    @UseGuards(AdminAuthGuard)
    @UseInterceptors(ClassSerializerInterceptor)
    @Post('create-account')
    createAccount(@Body() createAccountDto: CreateAccountDto) {
        if (!validateMnemonic(createAccountDto.mnemonic)) {
            // res.status(HttpStatus.BAD_REQUEST);
            throw new BadRequestException('Invalid mnemonic');
        }
        // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
        return this.hydraMainService.createAccount(createAccountDto);
    }

    @UseGuards(AdminAuthGuard)
    @Post('create-node')
    createHydraNode(@Body() createHydraNodeDto: CreateHydraNodeDto) {
        // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
        return this.hydraMainService.createHydraNode(createHydraNodeDto);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @Get('hydra-nodes')
    async getListNode(@Query() query: QueryHydraDto): Promise<InfinityPaginationResponseDto<HydraDto>> {
        const page = +(query?.page ?? 1);
        let limit = +(query?.limit ?? 10);
        if (limit > 50) {
            limit = 50;
        }
        console.log(typeof page, limit);

        return infinityPagination(
            await this.hydraMainService.getListHydraNode({
                pagination: {
                    page: query.page,
                    limit: query.limit,
                },
            }),
            { page, limit },
        );
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @Get('hydra-node/:id')
    async getNodeDetail(@Param('id') id: string): Promise<any> {
        return this.hydraMainService.getHydraNodeDetail(+id);
    }

    @UseGuards(AdminAuthGuard)
    @Post('create-party')
    createHydraParty(@Body() createPartyDto: CreatePartyDto) {
        // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
        return this.hydraMainService.createHydraParty(createPartyDto);
    }

    @Get('list-party')
    getListHydraParty() {
        // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
        return this.hydraMainService.getListHydraParty();
    }

    @UseGuards(AdminAuthGuard)
    @UseInterceptors(ClassSerializerInterceptor)
    @Post('active-party')
    activeHydraParty(@Body() activePartyDto: ReqActivePartyDto) {
        // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
        return this.hydraMainService.activeHydraParty(activePartyDto);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @Post('deactive-party')
    deactiveHydraParty(@Body() deactivePartyDto: ReqActivePartyDto) {
        // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
        return this.hydraMainService.deactiveHydraParty(deactivePartyDto);
    }

    @UseGuards(AdminAuthGuard)
    @UseInterceptors(ClassSerializerInterceptor)
    @Post('clear-party-data')
    clearData(@Body() clearPartyDto: ReqClearPartyDataDto) {
        // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
        return this.hydraMainService.clearHydraPersistents(clearPartyDto);
    }

    @UseInterceptors(ClassSerializerInterceptor)
    @Get('utxo/:address')
    getListUtxo(@Param('address') address: string) {
        return this.hydraMainService.getAddressUtxo(address);
    }

    // TODO: Helper api for hydra-bridge, remove it later
    @Post('commit-node')
    commitToHydraNode(@Body() commitHydraDto: CommitHydraDto) {
        return this.hydraMainService.commitToHydraNode(commitHydraDto);
    }

    // TODO: Helper api for hydra-bridge, remove it later
    @Post('submit-node')
    submitToHydraNode(@Body() submitBody: SubmitTxHydraDto) {
        return this.hydraMainService.submitTxToHydraNode(submitBody);
    }

    @Get('active-nodes')
    getActiveNodes() {
        return this.hydraMainService.getActiveNodeContainers();
    }
}
