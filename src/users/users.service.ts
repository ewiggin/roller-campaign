import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const exists = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email ya registrado');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: dto.email,
      password: hashed,
      role: dto.role ?? 'volunteer',
    });
    const saved = await this.usersRepository.save(user);

    if (dto.region_ids?.length) {
      await this.setRegions(saved.id, dto.region_ids);
    }

    return this.findOne(saved.id);
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find({
      relations: { regions: true },
    });
    return users.map(this.toDto);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { regions: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toDto(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== user.email) {
      const exists = await this.usersRepository.findOne({
        where: { email: dto.email },
      });
      if (exists) throw new ConflictException('Email ya registrado');
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    const { region_ids, ...rest } = dto;
    Object.assign(user, rest);
    await this.usersRepository.save(user);

    if (region_ids !== undefined) {
      await this.setRegions(id, region_ids);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.usersRepository.remove(user);
  }

  private async setRegions(userId: string, regionIds: string[]): Promise<void> {
    const isPostgres = this.dataSource.options.type === 'postgres';
    const ph = (i: number) => (isPostgres ? `$${i + 1}` : '?');

    await this.dataSource.query(
      `DELETE FROM region_coordinators WHERE ${isPostgres ? '"usersId"' : '"usersId"'} = ${ph(0)}`,
      [userId],
    );

    for (let i = 0; i < regionIds.length; i++) {
      await this.dataSource.query(
        `INSERT INTO region_coordinators ("regionsId", "usersId") VALUES (${ph(0)}, ${ph(1)})`,
        [regionIds[i], userId],
      );
    }
  }

  private toDto(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.role = user.role;
    dto.regions = (user.regions ?? []).map((r) => ({ id: r.id, name: r.name }));
    dto.created_at = user.created_at;
    dto.updated_at = user.updated_at;
    return dto;
  }
}
