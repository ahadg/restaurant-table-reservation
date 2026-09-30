import {
  Controller,
  Get,
  Post,
  Body,
  Inject,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AppService } from './app.service.js';
import {
  SERVICES,
  RegisterDto,
  LoginDto,
  JwtAuthGuard,
  CurrentUser,
} from '@app/common';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(SERVICES.AUTH_SERVICE) private readonly authClient: ClientProxy,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/ping')
  ping() {
    return {
      message: 'API Gateway is running',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('/auth/register')
  async register(@Body() dto: RegisterDto) {
    try {
      console.log("dto", dto)
      return await firstValueFrom(
        this.authClient.send({ cmd: 'register' }, dto),
      );
    } catch (error: any) {
      console.log("error", error)
      const status = error?.statusCode || error?.status || HttpStatus.BAD_REQUEST;
      const message = error?.message || 'Registration failed';
      throw new HttpException(message, status);
    }
  }

  @Post('/auth/login')
  async login(@Body() dto: LoginDto) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: 'login' }, dto),
      );
    } catch (error: any) {
      const status = error?.statusCode || error?.status || HttpStatus.UNAUTHORIZED;
      const message = error?.message || 'Authentication failed';
      throw new HttpException(message, status);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/auth/profile')
  async getProfile(@CurrentUser() user: { userId: string; email: string; role?: string }) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: 'get_profile' }, { userId: user.userId }),
      );
    } catch (error: any) {
      const status = error?.statusCode || error?.status || HttpStatus.NOT_FOUND;
      const message = error?.message || 'Profile fetch failed';
      throw new HttpException(message, status);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/auth/validate')
  async validateToken(@CurrentUser() user: { userId: string; email: string; role?: string }) {
    return {
      valid: true,
      user,
    };
  }
}
