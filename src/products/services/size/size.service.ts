import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  buildPaginated,
  PaginatedResponseDto,
} from '../../../common/dto/paginated-response.dto';
import { assertNoNullFields } from '../../../common/utils/assert-no-null-fields.util';
import { escapeLike } from '../../../common/utils/escape-like.util';
import { CreateSizeDto } from '../../dto/catalog/size/create-size.dto';
import { SizeListQueryDto } from '../../dto/catalog/size/size-list-query.dto';
import { SizeResponseDto } from '../../dto/catalog/size/size-response.dto';
import { UpdateSizeDto } from '../../dto/catalog/size/update-size.dto';
import { ProductSize } from '../../entities/product-size.entity';
import { Size } from '../../entities/size.entity';
import { SizeType } from '../../enums/product.enum';

/**
 * Sizes service (admin operations).
 *
 * Name and code are unique per sizing system, so the same code (for
 * example "40") may exist in both APPAREL and FOOTWEAR. The sizeType of a
 * size can never change (it is not part of UpdateSizeDto), because it is
 * part of the composite foreign keys used by products.
 */
@Injectable()
export class SizeService {
  /**
   * Injects the repositories used by this service.
   *
   * @param sizesRepository TypeORM repository for Size entities.
   * @param productSizesRepository TypeORM repository used to check usage before deleting.
   */
  constructor(
    @InjectRepository(Size)
    private readonly sizesRepository: Repository<Size>,
    @InjectRepository(ProductSize)
    private readonly productSizesRepository: Repository<ProductSize>,
  ) {}

  /**
   * Converts a Size entity into the admin response object.
   *
   * @param size Size entity.
   * @returns Admin response data.
   */
  private toResponseDto(size: Size): SizeResponseDto {
    return {
      id: size.id,
      name: size.name,
      code: size.code,
      sizeType: size.sizeType,
      sortOrder: size.sortOrder,
      isActive: size.isActive,
      createdAt: size.createdAt,
      updatedAt: size.updatedAt,
    };
  }

  /**
   * Finds a size entity by its identifier.
   *
   * @param id Size UUID.
   * @returns The matching size entity.
   * @throws NotFoundException If the size does not exist.
   */
  private async findEntity(id: string): Promise<Size> {
    const size = await this.sizesRepository.findOne({ where: { id } });

    if (!size) {
      throw new NotFoundException(`Size with ID ${id} was not found.`);
    }

    return size;
  }

  /**
   * Ensures the name and code are not used by another size of the same
   * sizing system. The database constraints remain the last line of defense.
   *
   * @param sizeType Sizing system to check inside.
   * @param fields Name and/or code to check.
   * @param excludeId Size that is allowed to keep its own values.
   * @throws ConflictException If another size uses the name or the code.
   */
  private async assertAvailable(
    sizeType: SizeType,
    fields: { name?: string; code?: string },
    excludeId?: string,
  ): Promise<void> {
    if (fields.code !== undefined) {
      const existing = await this.sizesRepository.findOne({
        where: { code: fields.code, sizeType },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A ${sizeType} size with the code "${fields.code}" already exists.`,
        );
      }
    }

    if (fields.name !== undefined) {
      const existing = await this.sizesRepository.findOne({
        where: { name: fields.name, sizeType },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A ${sizeType} size named "${fields.name}" already exists.`,
        );
      }
    }
  }

  /**
   * Creates a size.
   *
   * @param dto Validated creation data.
   * @returns The created size.
   * @throws ConflictException If the name or the code is already in use for the sizing system.
   */
  async create(dto: CreateSizeDto): Promise<SizeResponseDto> {
    await this.assertAvailable(dto.sizeType, {
      name: dto.name,
      code: dto.code,
    });

    const size = this.sizesRepository.create({
      name: dto.name,
      code: dto.code,
      sizeType: dto.sizeType,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    return this.toResponseDto(await this.sizesRepository.save(size));
  }

  /**
   * Lists sizes with pagination, search, sizing-system and active filters.
   *
   * @param query Validated list query.
   * @returns A page of sizes.
   */
  async findAll(
    query: SizeListQueryDto,
  ): Promise<PaginatedResponseDto<SizeResponseDto>> {
    const qb = this.sizesRepository.createQueryBuilder('size');

    if (query.q) {
      qb.andWhere('(size.name ILIKE :q OR size.code ILIKE :q)', {
        q: `%${escapeLike(query.q)}%`,
      });
    }

    if (query.sizeType !== undefined) {
      qb.andWhere('size.sizeType = :sizeType', { sizeType: query.sizeType });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('size.isActive = :isActive', { isActive: query.isActive });
    }

    const [sizes, total] = await qb
      .orderBy('size.sizeType', 'ASC')
      .addOrderBy('size.sortOrder', 'ASC')
      .addOrderBy('size.code', 'ASC')
      .addOrderBy('size.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return buildPaginated(
      sizes.map((size) => this.toResponseDto(size)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Retrieves a size by its identifier.
   *
   * @param id Size UUID.
   * @returns The matching size.
   * @throws NotFoundException If the size does not exist.
   */
  async findOne(id: string): Promise<SizeResponseDto> {
    return this.toResponseDto(await this.findEntity(id));
  }

  /**
   * Updates a size. No size field is nullable, so null is always rejected.
   *
   * @param id Size UUID.
   * @param dto Fields to update.
   * @returns The updated size.
   * @throws BadRequestException If any field is null.
   * @throws NotFoundException If the size does not exist.
   * @throws ConflictException If the name or the code is already in use for the sizing system.
   */
  async update(id: string, dto: UpdateSizeDto): Promise<SizeResponseDto> {
    assertNoNullFields(dto);

    const size = await this.findEntity(id);

    await this.assertAvailable(
      size.sizeType,
      { name: dto.name, code: dto.code },
      id,
    );

    if (dto.name !== undefined) size.name = dto.name;
    if (dto.code !== undefined) size.code = dto.code;
    if (dto.sortOrder !== undefined) size.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) size.isActive = dto.isActive;

    return this.toResponseDto(await this.sizesRepository.save(size));
  }

  /**
   * Deletes a size permanently. Allowed only when no product uses it.
   * Disabling is the recommended option.
   *
   * @param id Size UUID.
   * @throws NotFoundException If the size does not exist.
   * @throws ConflictException If the size is linked to products.
   */
  async remove(id: string): Promise<void> {
    const size = await this.findEntity(id);

    const links = await this.productSizesRepository.count({
      where: { sizeId: id },
    });

    if (links > 0) {
      throw new ConflictException(
        'This size is used by products. Disable it instead of deleting it.',
      );
    }

    await this.sizesRepository.remove(size);
  }
}