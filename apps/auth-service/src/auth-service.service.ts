import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { DatabaseService, users } from '@app/database';
import { RegisterDto, LoginDto } from '@app/common';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthServiceService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  getHello(): string {
    return 'Auth Service is active';
  }

  async register(dto: RegisterDto) {
    const existingUsers = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email));

    if (existingUsers.length > 0) {
      throw new RpcException({
        statusCode: 409,
        message: 'User with this email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const [newUser] = await this.dbService.db
      .insert(users)
      .values({
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role || 'USER',
      })
      .returning();

    const payload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const { password, ...userWithoutPassword } = newUser;

    return {
      message: 'User registered successfully',
      user: userWithoutPassword,
      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const [user] = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email));

    if (!user) {
      throw new RpcException({
        statusCode: 401,
        message: 'Invalid credentials',
      });
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new RpcException({
        statusCode: 401,
        message: 'Invalid credentials',
      });
    }

    await this.dbService.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const { password, ...userWithoutPassword } = user;

    return {
      message: 'Login successful',
      user: userWithoutPassword,
      accessToken,
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return { valid: true, payload };
    } catch {
      throw new RpcException({
        statusCode: 401,
        message: 'Invalid or expired token',
      });
    }
  }

  async getProfile(userId: string) {
    const [user] = await this.dbService.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new RpcException({
        statusCode: 404,
        message: 'User not found',
      });
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
