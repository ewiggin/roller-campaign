import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './strategies/jwt.strategy';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<JwtPayload | null> {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');

    if (email === adminEmail && password === adminPassword) {
      return { sub: 'admin', email, role: 'superadmin' };
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    return { sub: user.id, email: user.email, role: user.role };
  }

  login(user: JwtPayload): LoginResponseDto {
    return { access_token: this.jwtService.sign(user) };
  }
}
