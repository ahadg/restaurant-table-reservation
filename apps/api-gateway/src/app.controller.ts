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
import type { ClientProxy, ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { AppService } from './app.service.js';
import {
  SERVICES,
  RegisterDto,
  LoginDto,
  CreateReservationDto,
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

interface TableGrpcService {
  listFloors(data: { restaurantId: string }): Observable<any>;
  getFloor(data: { id: string }): Observable<any>;
  createFloor(data: { restaurantId: string; name?: string; floorNumber: number }): Observable<any>;
  updateFloor(data: { id: string; name?: string; floorNumber?: number }): Observable<any>;
  deleteFloor(data: { id: string }): Observable<any>;
  listTables(data: { restaurantId: string; floorId?: string }): Observable<any>;
  getTable(data: { id: string }): Observable<any>;
  createTable(data: {
    restaurantId: string;
    floorId: string;
    ownerId?: string;
    name: string;
    tableNumber: number;
    capacity: number;
  }): Observable<any>;
  updateTable(data: { id: string; name?: string; tableNumber?: number; capacity?: number }): Observable<any>;
  deleteTable(data: { id: string }): Observable<any>;
  listCombinations(data: { floorId: string }): Observable<any>;
  createCombination(data: { floorId: string; tableIds: string[] }): Observable<any>;
  deleteCombination(data: { id: string }): Observable<any>;
}

interface ReservationGrpcService {
  createReservation(data: any): Observable<any>;
  getReservation(data: { id: string }): Observable<any>;
  listReservations(data: { userId?: string; restaurantId?: string; page?: number; limit?: number }): Observable<any>;
  cancelReservation(data: { id: string; userId?: string }): Observable<any>;
}

@Controller()
export class AppController implements OnModuleInit {
  private restaurantService!: RestaurantGrpcService;
  private tableService!: TableGrpcService;
  private reservationService!: ReservationGrpcService;

  constructor(
    private readonly appService: AppService,
    @Inject(SERVICES.AUTH_SERVICE) private readonly authClient: ClientProxy,
    @Inject(SERVICES.NOTIFICATION_SERVICE) private readonly notificationClient: ClientProxy,
    @Inject(SERVICES.RESTAURANT_SERVICE) private readonly restaurantClient: ClientGrpc,
    @Inject(SERVICES.TABLE_SERVICE) private readonly tableClient: ClientGrpc,
    @Inject(SERVICES.RESERVATION_SERVICE) private readonly reservationClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.restaurantService =
      this.restaurantClient.getService<RestaurantGrpcService>('RestaurantService');
    this.tableService = this.tableClient.getService<TableGrpcService>('TableService');
    this.reservationService =
      this.reservationClient.getService<ReservationGrpcService>('ReservationService');
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

  @Post('/auth/register')
  async register(@Body() dto: RegisterDto) {
    try {
      return await firstValueFrom(this.authClient.send({ cmd: 'register' }, dto));
    } catch (error: any) {
      throw this.httpFromRpc(error, HttpStatus.BAD_REQUEST, 'Registration failed');
    }
  }

  @Post('/auth/login')
  async login(@Body() dto: LoginDto) {
    try {
      return await firstValueFrom(this.authClient.send({ cmd: 'login' }, dto));
    } catch (error: any) {
      throw this.httpFromRpc(error, HttpStatus.UNAUTHORIZED, 'Authentication failed');
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
      throw this.httpFromRpc(error, HttpStatus.NOT_FOUND, 'Profile fetch failed');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/auth/validate')
  async validateToken(@CurrentUser() user: { userId: string; email: string; role?: string }) {
    return { valid: true, user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants')
  async createRestaurant(
    @CurrentUser() user: { userId: string },
    @Body() body: { name: string; description?: string; phone?: string; email?: string; cuisine?: string },
  ) {
    return this.grpcCall(
      this.restaurantService.createRestaurant({ ...body, ownerId: user.userId }),
      'Failed to create restaurant',
    );
  }

  @Get('/restaurants')
  async listRestaurants(@Query('page') page = '1', @Query('limit') limit = '10') {
    return this.grpcCall(
      this.restaurantService.listRestaurants({ page: Number(page), limit: Number(limit) }),
      'Failed to list restaurants',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  @Get('/restaurants/:id')
  async getRestaurant(@Param('id') id: string) {
    return this.grpcCall(
      this.restaurantService.getRestaurant({ id }),
      'Restaurant not found',
      HttpStatus.NOT_FOUND,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('/restaurants/:id')
  async updateRestaurant(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; phone?: string; email?: string; cuisine?: string },
  ) {
    return this.grpcCall(
      this.restaurantService.updateRestaurant({ id, ...body }),
      'Failed to update restaurant',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/restaurants/:id')
  async deleteRestaurant(@Param('id') id: string) {
    return this.grpcCall(
      this.restaurantService.deleteRestaurant({ id }),
      'Failed to delete restaurant',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/location')
  async addLocation(
    @Param('id') id: string,
    @Body() body: { address: string; city: string; state?: string; zipCode?: string; country?: string; latitude?: string; longitude?: string },
  ) {
    return this.grpcCall(
      this.restaurantService.addLocation({ restaurantId: id, ...body }),
      'Failed to add location',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/opening-hours')
  async setOpeningHours(
    @Param('id') id: string,
    @Body() body: { hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed?: boolean }> },
  ) {
    return this.grpcCall(
      this.restaurantService.setOpeningHours({ restaurantId: id, hours: body.hours || [] }),
      'Failed to set opening hours',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/house-rules')
  async addHouseRule(@Param('id') id: string, @Body() body: { rule: string }) {
    return this.grpcCall(
      this.restaurantService.addHouseRule({ restaurantId: id, rule: body.rule }),
      'Failed to add house rule',
    );
  }

  @Get('/restaurants/:id/floors')
  async listFloors(@Param('id') restaurantId: string) {
    return this.grpcCall(this.tableService.listFloors({ restaurantId }), 'Failed to list floors');
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/floors')
  async createFloor(
    @Param('id') restaurantId: string,
    @Body() body: { name?: string; floorNumber: number },
  ) {
    return this.grpcCall(
      this.tableService.createFloor({ restaurantId, ...body }),
      'Failed to create floor',
    );
  }

  @Get('/floors/:floorId')
  async getFloor(@Param('floorId') id: string) {
    return this.grpcCall(this.tableService.getFloor({ id }), 'Floor not found', HttpStatus.NOT_FOUND);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/floors/:floorId')
  async updateFloor(
    @Param('floorId') id: string,
    @Body() body: { name?: string; floorNumber?: number },
  ) {
    return this.grpcCall(this.tableService.updateFloor({ id, ...body }), 'Failed to update floor');
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/floors/:floorId')
  async deleteFloor(@Param('floorId') id: string) {
    return this.grpcCall(this.tableService.deleteFloor({ id }), 'Failed to delete floor');
  }

  @Get('/restaurants/:id/tables')
  async listTables(@Param('id') restaurantId: string, @Query('floorId') floorId?: string) {
    return this.grpcCall(
      this.tableService.listTables({ restaurantId, floorId }),
      'Failed to list tables',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/restaurants/:id/tables')
  async createTable(
    @CurrentUser() user: { userId: string },
    @Param('id') restaurantId: string,
    @Body() body: { floorId: string; name: string; tableNumber: number; capacity: number },
  ) {
    return this.grpcCall(
      this.tableService.createTable({ restaurantId, ownerId: user.userId, ...body }),
      'Failed to create table',
    );
  }

  @Get('/tables/:tableId')
  async getTable(@Param('tableId') id: string) {
    return this.grpcCall(this.tableService.getTable({ id }), 'Table not found', HttpStatus.NOT_FOUND);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/tables/:tableId')
  async updateTable(
    @Param('tableId') id: string,
    @Body() body: { name?: string; tableNumber?: number; capacity?: number },
  ) {
    return this.grpcCall(this.tableService.updateTable({ id, ...body }), 'Failed to update table');
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/tables/:tableId')
  async deleteTable(@Param('tableId') id: string) {
    return this.grpcCall(this.tableService.deleteTable({ id }), 'Failed to delete table');
  }

  @Get('/floors/:floorId/combinations')
  async listCombinations(@Param('floorId') floorId: string) {
    return this.grpcCall(
      this.tableService.listCombinations({ floorId }),
      'Failed to list combinations',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/floors/:floorId/combinations')
  async createCombination(
    @Param('floorId') floorId: string,
    @Body() body: { tableIds: string[] },
  ) {
    return this.grpcCall(
      this.tableService.createCombination({ floorId, tableIds: body.tableIds || [] }),
      'Failed to create combination',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/combinations/:id')
  async deleteCombination(@Param('id') id: string) {
    return this.grpcCall(
      this.tableService.deleteCombination({ id }),
      'Failed to delete combination',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/reservations')
  async createReservation(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateReservationDto,
  ) {
    return this.grpcCall(
      this.reservationService.createReservation({ ...dto, userId: user.userId }),
      'Failed to create reservation',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/reservations')
  async listReservations(
    @CurrentUser() user: { userId: string },
    @Query('restaurantId') restaurantId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.grpcCall(
      this.reservationService.listReservations({
        userId: user.userId,
        restaurantId,
        page: Number(page),
        limit: Number(limit),
      }),
      'Failed to list reservations',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/reservations/:id')
  async getReservation(@Param('id') id: string) {
    return this.grpcCall(
      this.reservationService.getReservation({ id }),
      'Reservation not found',
      HttpStatus.NOT_FOUND,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('/reservations/:id/cancel')
  async cancelReservation(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.grpcCall(
      this.reservationService.cancelReservation({ id, userId: user.userId }),
      'Failed to cancel reservation',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/notifications')
  async listNotifications(@CurrentUser() user: { userId: string }) {
    try {
      return await firstValueFrom(
        this.notificationClient.send({ cmd: 'list_notifications' }, { userId: user.userId }),
      );
    } catch (error: any) {
      throw this.httpFromRpc(error, HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to list notifications');
    }
  }

  private async grpcCall<T>(obs: Observable<T>, fallback: string, status = HttpStatus.BAD_REQUEST) {
    try {
      return await firstValueFrom(obs);
    } catch (error: any) {
      throw new HttpException(error?.details || error?.message || fallback, status);
    }
  }

  private httpFromRpc(error: any, fallbackStatus: number, fallbackMessage: string) {
    const status = error?.statusCode || error?.status || fallbackStatus;
    const message = error?.message || fallbackMessage;
    return new HttpException(message, status);
  }
}
