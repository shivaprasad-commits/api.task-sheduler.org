import type { SQL } from "drizzle-orm";

import { and, eq, getTableName, inArray, isNull, sql } from "drizzle-orm";

import type { DBTable, DBTableRow, InQueryData, OrderByQueryData, WhereQueryData } from "../types/dbTypes.js";

import { db } from "../db/configuration.js";

function prepareSelectColumnsForQuery(table: DBTable, columnsToSelect?: any) {
  if (!columnsToSelect) {
    return null;
  }

  if (columnsToSelect.length === 0) {
    return {};
  }

  const columnsForQuery: Record<string, SQL> = {};
  // loop through columns and prepare the select query object
  columnsToSelect.map((column: string) => {
    return (columnsForQuery[column as string] = sql.raw(
      `${getTableName(table)}.${column as string}`,
    ));
  });
  return columnsForQuery;
}

function prepareWhereQueryConditions<R extends DBTableRow>(
  table: DBTable,
  whereQueryData?: WhereQueryData<R>,
) {
  if (
    whereQueryData
    && Object.keys(whereQueryData).length > 0
    && whereQueryData.columns.length > 0
  ) {
    const { columns, values } = whereQueryData;
    const whereQueries: SQL[] = [];
    const orConditions: SQL[] = [];

    for (let i = 0; i < columns.length; i++) {
      const columnInfo = sql.raw(`${getTableName(table)}.${columns[i] as string}`);
      if (typeof values[i] === "string" && values[i].includes("%")) {
        if (columns[i] === "shape" || columns[i] === "color" || columns[i] === "cut" || columns[i] === "clarity" || columns[i] === "polish" || columns[i] === "symmetry" || columns[i] === "rep_no" || columns[i] === "carat") {
          orConditions.push(sql`${columnInfo} ILIKE ${values[i]}`);
        }
        else {
          whereQueries.push(sql`${columnInfo} ILIKE ${values[i]}`);
        }
      }
      else if (columns[i] === "deleted_at") {
        whereQueries.push(isNull(columnInfo));
      }
      else if (Array.isArray(values[i]) && values[i].length > 0) {
        whereQueries.push(sql`${columnInfo} in (${sql.join(values[i], sql`, `)})`);
      }
      else if (typeof values[i] === "object" && values[i] !== null) {
        const value = values[i] as { gte?: Date | string; lte?: Date | string };

        if (value.gte && value.lte) {
          whereQueries.push(
            sql`${columnInfo} BETWEEN ${value.gte} AND ${value.lte} `,
          );
        }
        else if (value.gte) {
          whereQueries.push(sql`${columnInfo} >= ${value.gte} `);
        }
        else if (value.lte) {
          whereQueries.push(sql`${columnInfo} <= ${value.lte} `);
        }
      }
      else {
        whereQueries.push(eq(columnInfo, values[i]));
      }
    }

    if (orConditions.length > 0) {
      whereQueries.push(sql`(${sql.join(orConditions, sql` OR `)})`);
    }
    return whereQueries;
  }
  return null;
}

// function prepareWhereQueryConditions<T extends DBTable>(table: T, whereQueryData?: WhereQueryData<T>): SQL[] | null {
//   if (!whereQueryData || Object.keys(whereQueryData).length < 1 || whereQueryData.columns.length < 1) {
//     return null;
//   }
//   const { columns, values, relations } = whereQueryData;
//   const whereQueries: SQL[] = [];
//   const orQueries: SQL[] = [];
//   for (let i = 0; i < columns.length; i++) {
//     const columnInfo = table[columns[i] as keyof typeof table] as unknown as SQLWrapper;
//     const value = values[i];
//     const relation = relations?.[i] ?? "=";
//     switch (relation) {
//       case "=":
//         whereQueries.push(sql`${ columnInfo } = ${ value } `);
//         break;

//       case "!=":
//         whereQueries.push(sql`${ columnInfo } != ${ value } `);
//         break;

//       case "<":
//         whereQueries.push(sql`${ columnInfo } <${ value }`);
//         break;

//       case "<=":
//         whereQueries.push(sql`${ columnInfo } <= ${ value } `);
//         break;

//       case ">":
//         whereQueries.push(sql`${ columnInfo } > ${ value } `);
//         break;

//       case ">=":
//         whereQueries.push(sql`${ columnInfo } >= ${ value } `);
//         break;

//       case "ILIKE":
//         whereQueries.push(sql`${ columnInfo } ILIKE ${ value } `);
//         break;

//       case "IS NULL":
//         whereQueries.push(isNull(columnInfo));
//         break;

//       case "contains":
//         orQueries.push(sql`${ columnInfo } ILIKE ${ `%${value}%` } `);
//         break;

//       case "@>":
//         // Used for JSONB contains (e.g., for arrays like visible_to)
//         whereQueries.push(sql`${ columnInfo } @> ${ sql.raw(`'[${value}]'::jsonb`) } `);
//         break;

//       case "BETWEEN":
//         if (typeof value === "object" && value !== null && "gte" in value && "lte" in value) {
//           whereQueries.push(sql`${ columnInfo } BETWEEN ${ value.gte } AND ${ value.lte } `);
//         }
//         break;

//       case "IN":
//         if (Array.isArray(value) && value.length > 0) {
//           whereQueries.push(sql`${ columnInfo } IN(${ sql.join(value, sql`, `) })`);
//         }
//         else {
//           whereQueries.push(sql`FALSE`);
//         }
//         break;

//       default:
//         break;
//     }
//   }
//   if (orQueries.length > 0) {
//     whereQueries.push(sql`(${ sql.join(orQueries, sql` OR `) })`);
//   }
//   return whereQueries;
// }

function prepareOrderByQueryConditions<R extends DBTableRow>(
  table: DBTable,
  orderByQueryData?: OrderByQueryData<R>,
) {
  const orderByQueries: SQL[] = [];

  if (
    !orderByQueryData
    || Object.keys(orderByQueryData).length === 0
    || orderByQueryData.columns.length === 0
  ) {
    const orderByQuery = sql.raw(`${getTableName(table)}.id desc`);
    orderByQueries.push(orderByQuery);
  }

  if (
    orderByQueryData
    && Object.keys(orderByQueryData).length > 0
    && orderByQueryData.columns.length > 0
  ) {
    const { columns, values } = orderByQueryData;
    for (let i = 0; i < columns.length; i++) {
      const orderByQuery = sql.raw(
        `${getTableName(table)}.${columns[i] as string} ${values[i] as string} `,
      );
      orderByQueries.push(orderByQuery);
    }
  }
  return orderByQueries;
}

function prepareInQueryCondition<R extends DBTableRow>(
  table: DBTable,
  inQueryData?: InQueryData<R>,
) {
  if (
    inQueryData
    && Object.keys(inQueryData).length > 0
    && inQueryData.values.length > 0
  ) {
    const columnInfo = sql.raw(
      `${getTableName(table)}.${inQueryData.key as string} `,
    );
    const inQuery = inArray(columnInfo, inQueryData.values);
    return inQuery;
  }
  return null;
}

async function executeQuery<R extends DBTableRow, C extends keyof R = keyof R>(
  table: DBTable,
  whereQuery: SQL | undefined | null,
  columnsRequired: Record<string, SQL> | null,
  orderByConditions: SQL[],
  inQueryCondition: SQL | null,
  paginationData?: { page: number; pageSize: number },
  trx?: unknown,
) {
  let dQuery = columnsRequired
    ? db.select(columnsRequired).from(table).$dynamic()
    : db.select().from(table).$dynamic();

  if (whereQuery && inQueryCondition) {
    dQuery = dQuery.where(and(whereQuery, inQueryCondition));
  }
  else if (whereQuery) {
    dQuery = dQuery.where(whereQuery);
  }
  else if (inQueryCondition) {
    dQuery = dQuery.where(inQueryCondition);
  }

  dQuery = dQuery.orderBy(...orderByConditions);

  if (paginationData) {
    const { page, pageSize } = paginationData;
    dQuery = dQuery.limit(pageSize).offset((page - 1) * pageSize);
  }

  const results = await dQuery;

  if (columnsRequired) {
    return results as Pick<R, C>[];
  }
  return results as R[];
}

export {
  executeQuery,
  prepareInQueryCondition,
  prepareOrderByQueryConditions,
  prepareSelectColumnsForQuery,
  prepareWhereQueryConditions,
};
