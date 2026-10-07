import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/rbac';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LOCATION_CREATE)
  @ApiOperation({ summary: 'Create location / region' })
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LOCATION_VIEW)
  @ApiOperation({ summary: 'List locations' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.locationsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LOCATION_VIEW)
  @ApiOperation({ summary: 'Get location' })
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LOCATION_UPDATE)
  @ApiOperation({ summary: 'Update location' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }
}
