import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Answers visibility questions about categories.
 *
 * A category is effectively active only when it and all of its ancestors
 * are active. Deactivating a category never changes data: products under
 * an inactive category are hidden by this rule.
 */
@Injectable()
export class CategoryVisibilityService {
  /**
   * Injects the data source used for queries outside a transaction.
   *
   * @param dataSource TypeORM data source.
   */
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Checks whether a category and all its ancestors are active.
   *
   * @param categoryId Category UUID.
   * @param manager Entity manager of a running transaction (optional).
   * @returns True if effectively active, false if it or an ancestor is inactive, null if the category does not exist.
   */
  async isEffectivelyActive(
    categoryId: string,
    manager?: EntityManager,
  ): Promise<boolean | null> {
    const runner = manager ?? this.dataSource.manager;

    const rows: { active: boolean | null; total: string }[] =
      await runner.query(
        `WITH RECURSIVE "chain" AS (
           SELECT "id", "parentId", "isActive", 1 AS "level"
           FROM "categories" WHERE "id" = $1
           UNION ALL
           SELECT c."id", c."parentId", c."isActive", ch."level" + 1
           FROM "categories" c
           JOIN "chain" ch ON c."id" = ch."parentId"
           WHERE ch."level" < 50
         )
         SELECT bool_and("isActive") AS "active", COUNT(*) AS "total"
         FROM "chain"`,
        [categoryId],
      );

    const row = rows[0];

    if (!row || Number(row.total) === 0) {
      return null;
    }

    return row.active === true;
  }
}