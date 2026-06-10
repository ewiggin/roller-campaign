import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { Region } from '../regions/entities/region.entity';
import { Host } from '../hosts/entities/host.entity';
import { CartsService } from './carts.service';
import { CartsController } from './carts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, Region, Host])],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
