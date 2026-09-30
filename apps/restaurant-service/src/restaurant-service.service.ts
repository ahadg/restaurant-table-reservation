import { Injectable } from '@nestjs/common';

@Injectable()
export class RestaurantServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
