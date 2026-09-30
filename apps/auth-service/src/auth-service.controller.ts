import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthServiceService } from './auth-service.service.js';
import { RegisterDto, LoginDto } from '@app/common';

@Controller()
export class AuthServiceController {
  constructor(private readonly authService: AuthServiceService) { }

  @MessagePattern({ cmd: 'health_check' })
  healthCheck(): string {
    return this.authService.getHello();
  }

  @MessagePattern({ cmd: 'register' })
  register(@Payload() dto: RegisterDto) {
    console.log("dto_service", dto)
    return this.authService.register(dto);
  }

  @MessagePattern({ cmd: 'login' })
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern({ cmd: 'validate_token' })
  validateToken(@Payload() data: { token: string }) {
    return this.authService.validateToken(data.token);
  }

  @MessagePattern({ cmd: 'get_profile' })
  getProfile(@Payload() data: { userId: string }) {
    return this.authService.getProfile(data.userId);
  }
}
