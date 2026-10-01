import { Injectable } from '@nestjs/common';

@Injectable()
export class TableServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
