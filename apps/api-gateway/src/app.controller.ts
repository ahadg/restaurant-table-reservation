import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Inject,
  UseGuards,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy, ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { AppService } from './app.service.js';
import {
  SERVICES,
  RegisterDto,
  LoginDto,
  JwtAuthGuard,
  CurrentUser,
} from '@app/common';

interface RestaurantGrpcService {
  createRestaurant(data: any): Observable<any>;
  getRestaurant(data: { id: string }): Observable<any>;
  listRestaurants(data: { page: number; limit: number }): Observable<any>;
  updateRestaurant(data: any): Observable<any>;
  deleteRestaurant(data: { id: string }): Observable<any>;
  addLocation(data: any): Observable<any>;
  setOpeningHours(data: any): Observable<any>;
  addHouseRule(data: any): Observable<any>;
}

@Controller()
export class AppController implements OnModuleInit {
  private restaurantService!: RestaurantGrpcService;

  constructor(
    private readonly appService: AppService,
    @Inject(SERVICES.AUTH_SERVICE) private readonly authClient: ClientProxy,
    //In AppModule (app.module.ts), we registered the gRPC client with NestJS ClientsModule:
    // We inject the raw ClientGrpc instance:
    @Inject(SERVICES.RESTAURANT_SERVICE) private readonly restaurantClient: ClientGrpc,
  ) { }

  onModuleInit() {
    // in onModuleInit(), NestJS reads restaurant.proto and dynamically generates client methods matching the gRPC service definition:
    this.restaurantService =
      this.restaurantClient.getService<RestaurantGrpcService>('RestaurantService');
  }

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

  // --- Auth Endpoints (TCP) ---

  @Post('/auth/register')
  async register(@Body() dto: RegisterDto) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: 'register' }, dto),
      );
    } catch (error: any) {
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

  // --- Restaurant Endpoints (gRPC) ---

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants')
  async createRestaurant(
    @CurrentUser() user: { userId: string },
    @Body() body: { name: string; description?: string; phone?: string; email?: string; cuisine?: string },
  ) {
    try {
      return await firstValueFrom(
        this.restaurantService.createRestaurant({
          ...body,
          ownerId: user.userId,
        }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Failed to create restaurant', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('/restaurants')
  async listRestaurants(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    try {
      return await firstValueFrom(
        this.restaurantService.listRestaurants({
          page: Number(page),
          limit: Number(limit),
        }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Failed to list restaurants', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/restaurants/:id')
  async getRestaurant(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.restaurantService.getRestaurant({ id }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Restaurant not found', HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('/restaurants/:id')
  async updateRestaurant(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; phone?: string; email?: string; cuisine?: string },
  ) {
    try {
      return await firstValueFrom(
        this.restaurantService.updateRestaurant({
          id,
          ...body,
        }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Failed to update restaurant', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/restaurants/:id')
  async deleteRestaurant(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.restaurantService.deleteRestaurant({ id }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Failed to delete restaurant', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/location')
  async addLocation(
    @Param('id') id: string,
    @Body() body: { address: string; city: string; state?: string; zipCode?: string; country?: string; latitude?: string; longitude?: string },
  ) {
    try {
      return await firstValueFrom(
        this.restaurantService.addLocation({
          restaurantId: id,
          ...body,
        }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Failed to add location', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/opening-hours')
  async setOpeningHours(
    @Param('id') id: string,
    @Body() body: { hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed?: boolean }> },
  ) {
    try {
      return await firstValueFrom(
        this.restaurantService.setOpeningHours({
          restaurantId: id,
          hours: body.hours || [],
        }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Failed to set opening hours', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/house-rules')
  async addHouseRule(
    @Param('id') id: string,
    @Body() body: { rule: string },
  ) {
    try {
      return await firstValueFrom(
        this.restaurantService.addHouseRule({
          restaurantId: id,
          rule: body.rule,
        }),
      );
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || 'Failed to add house rule', HttpStatus.BAD_REQUEST);
    }
  }
}
