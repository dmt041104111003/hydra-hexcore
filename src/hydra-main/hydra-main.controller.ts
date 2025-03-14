import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
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

@Controller('hydra-main')
export class HydraMainController {
  constructor(private hydraMainService: HydraMainService) {}

  @Get('request-node')
  requestHydraNode() {
    return 'This route uses a wildcard';
  }

  @Get('node-info')
  getCardanoNodeInfo() {
    return this.hydraMainService.getCardanoNodeInfo();
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get('list-account')
  getListAccount() {
    return this.hydraMainService.getListAccount();
  }

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

  @Post('create-node')
  createHydraNode(@Body() createHydraNodeDto: CreateHydraNodeDto) {
    // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
    return this.hydraMainService.createHydraNode(createHydraNodeDto);
  }

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

  @UseInterceptors(ClassSerializerInterceptor)
  @Post('active-party')
  activeHydraParty(@Body() activePartyDto: ReqActivePartyDto) {
    // res.status(HttpStatus.OK).json(this.hydraMainService.createAccount(createAccountDto));
    return this.hydraMainService.activeHydraParty(activePartyDto);
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get('utxo/:address')
  getListUtxo(@Param('address') address: string) {
    return this.hydraMainService.getAddressUtxo(address);
  }

  @Post('commit-node')
  commitToHydraNode(@Body() commitHydraDto: CommitHydraDto) {
    return this.hydraMainService.commitToHydraNode(commitHydraDto);
  }

  @Post('submit-node')
  submitToHydraNode(@Body() submitBody: SubmitTxHydraDto) {
    return this.hydraMainService.submitTxToHydraNode(submitBody);
  }
}
