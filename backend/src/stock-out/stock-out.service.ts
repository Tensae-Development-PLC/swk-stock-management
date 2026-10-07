import { BadRequestException, Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { TransfersService } from '../transfers/transfers.service';
import { CreateStockOutDto, StockOutMethod } from './dto/create-stock-out.dto';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class StockOutService {
  constructor(
    private readonly salesService: SalesService,
    private readonly transfersService: TransfersService,
  ) {}

  create(dto: CreateStockOutDto, actor: AuthUser, ip?: string) {
    if (dto.method === StockOutMethod.DIRECT_SALE) {
      if (!dto.locationId || !dto.saleDate) {
        throw new BadRequestException('locationId and saleDate are required for a direct sale.');
      }
      const items = dto.items.map((item) => {
        if (item.sellingPrice === undefined) {
          throw new BadRequestException(
            `Selling price is required for serial ${item.serialNumber}.`,
          );
        }
        return { serialNumber: item.serialNumber, sellingPrice: item.sellingPrice };
      });
      if (!dto.fsNumber || dto.stockYear === undefined) {
        throw new BadRequestException('fsNumber and stockYear are required for a direct sale.');
      }
      return this.salesService.create(
        {
          locationId: dto.locationId,
          saleDate: dto.saleDate,
          stockYear: dto.stockYear,
          fsNumber: dto.fsNumber,
          notes: dto.notes,
          items,
        },
        actor,
        ip,
      );
    }

    if (
      !dto.sourceLocationId ||
      !dto.destinationLocationId ||
      !dto.reasonId ||
      !dto.fsNumber ||
      dto.stockYear === undefined
    ) {
      throw new BadRequestException(
        'sourceLocationId, destinationLocationId, reasonId, fsNumber, and stockYear are required for a regional transfer.',
      );
    }

    return this.transfersService.create(
      {
        sourceLocationId: dto.sourceLocationId,
        destinationLocationId: dto.destinationLocationId,
        reasonId: dto.reasonId,
        stockYear: dto.stockYear,
        fsNumber: dto.fsNumber,
        receiverName: dto.receiverName,
        receiverPhone: dto.receiverPhone,
        dispatchDate: dto.dispatchDate,
        notes: dto.notes,
        serialNumbers: dto.items.map((i) => i.serialNumber),
      },
      actor,
      ip,
    );
  }
}
