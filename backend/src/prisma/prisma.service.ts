import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async nextReference(prefix: string, year = new Date().getUTCFullYear()): Promise<string> {
    const sequence = await this.documentSequence.upsert({
      where: { prefix_year: { prefix, year } },
      create: { prefix, year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `${prefix}-${year}-${String(sequence.lastNumber).padStart(4, '0')}`;
  }
}
