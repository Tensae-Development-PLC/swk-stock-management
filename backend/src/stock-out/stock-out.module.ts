import { Module } from '@nestjs/common';
import { StockOutService } from './stock-out.service';
import { StockOutController } from './stock-out.controller';
import { SalesModule } from '../sales/sales.module';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [SalesModule, TransfersModule],
  controllers: [StockOutController],
  providers: [StockOutService],
})
export class StockOutModule {}
