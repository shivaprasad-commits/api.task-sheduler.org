import { and, asc, count, desc, eq, getTableName, inArray, sql } from "drizzle-orm";

import type { DBNewRecord, DBNewRecords, DBTable, DBTableRow, InQueryData, OrderByQueryData, PaginationInfo, Transaction, UpdateRecordData, WhereQueryData } from "../../types/dbTypes.js";

import { db } from "../../db/configuration.js";
import { executeQuery, prepareInQueryCondition, prepareOrderByQueryConditions, prepareSelectColumnsForQuery, prepareWhereQueryConditions } from "../../utils/dbUtils.js";

// type SelectedKeys<T, K extends keyof T> = {
//   [P in K]: T[P];
// };

async function getRecordById<R extends DBTableRow, C extends keyof R = keyof R>(
  table: DBTable,
  id: number,
  columnsToSelect?: any,
): Promise<R | Pick<R, C> | null> {
  const columnsRequired = prepareSelectColumnsForQuery(table, columnsToSelect);

  const result = columnsRequired
    ? await db.select(columnsRequired).from(table).where(eq(table.id, id))
    : await db.select().from(table).where(eq(table.id, id));

  if (result.length === 0) {
    return null;
  }

  if (columnsRequired) {
    return result[0] as Pick<R, C>;

    // return result[0] as SelectedKeys<R, C>
    // return result[0] as Record<C, any>
  }

  return result[0] as R;
}

async function getRecordsConditionally<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  whereQueryData: WhereQueryData<R>,
  columnsToSelect?: any,
  orderByQueryData?: OrderByQueryData<R>,
  inQueryData?: InQueryData<R>,
  trx?: unknown,
) {
  const columnsRequired = prepareSelectColumnsForQuery(table, columnsToSelect);
  const whereConditions = prepareWhereQueryConditions(table, whereQueryData);
  const inQueryCondition = prepareInQueryCondition(table, inQueryData);
  const orderByConditions = prepareOrderByQueryConditions(
    table,
    orderByQueryData,
  );

  const whereQuery = whereConditions ? and(...whereConditions) : null;

  const results = await executeQuery<R, C>(
    table,
    whereQuery,
    columnsRequired,
    orderByConditions,
    inQueryCondition,
  );

  // if (!results || results.length === 0) {
  //   return null;
  // }

  return results;
}

async function getPaginatedRecordsConditionally<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  page: number,
  pageSize: number,
  orderByQueryData?: OrderByQueryData<R>,
  whereQueryData?: WhereQueryData<R>,
  columnsToSelect?: any,
  inQueryData?: InQueryData<R>,
) {
  let countQuery = db
    .select({ total: count(table.id) })
    .from(table)
    .$dynamic();

  if (whereQueryData && inQueryData) {
    // Case 1: Both where and in query data exist
    const whereConditions = prepareWhereQueryConditions(table, whereQueryData);
    const inQueryCondition = prepareInQueryCondition(table, inQueryData);

    if (whereConditions && whereConditions.length > 0 && inQueryCondition) {
      // Both conditions are valid - combine them with AND
      countQuery = countQuery.where(
        and(and(...whereConditions), inQueryCondition),
      );
    }
  }
  else if (whereQueryData) {
    // Case 2: Only where query data exists
    const whereConditions = prepareWhereQueryConditions(table, whereQueryData);
    if (whereConditions && whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }
  }
  const recordsCount = await countQuery;
  const total_records = recordsCount[0]?.total || 0;
  const total_pages = Math.ceil(total_records / pageSize) || 1;

  const pagination_info: PaginationInfo = {
    total_records,
    total_pages,
    page_size: pageSize,
    current_page: page > total_pages ? total_pages : page,
    next_page: page >= total_pages ? null : page + 1,
    prev_page: page <= 1 ? null : page - 1,
  };

  if (total_records === 0) {
    return {
      pagination_info,
      records: [],
    };
  }

  const columnsRequired = prepareSelectColumnsForQuery(table, columnsToSelect);
  const whereConditions = prepareWhereQueryConditions(table, whereQueryData);
  const orderByConditions = prepareOrderByQueryConditions(
    table,
    orderByQueryData,
  );
  const inQueryCondition = prepareInQueryCondition(table, inQueryData);

  const whereQuery = whereConditions ? and(...whereConditions) : null;

  const paginationData = { page, pageSize };
  const results = await executeQuery<R, C>(
    table,
    whereQuery,
    columnsRequired,
    orderByConditions,
    inQueryCondition,
    paginationData,
  );

  // if (!results || results.length === 0) {
  //   return null;
  // }

  return {
    pagination_info,
    records: results,
  };
}

async function getPaginatedRecordsConditionallywithtrx<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  page: number,
  pageSize: number,
  orderByQueryData?: OrderByQueryData<R>,
  whereQueryData?: WhereQueryData<R>,
  columnsToSelect?: any,
  inQueryData?: InQueryData<R>,
  trx?: Transaction,
) {
  const client = trx ?? db;

  let countQuery = client
    .select({ total: count(table.id) })
    .from(table)
    .$dynamic();

  if (whereQueryData && inQueryData) {
    const whereConditions = prepareWhereQueryConditions(table, whereQueryData);
    const inQueryCondition = prepareInQueryCondition(table, inQueryData);

    if (whereConditions && whereConditions.length > 0 && inQueryCondition) {
      countQuery = countQuery.where(
        and(and(...whereConditions), inQueryCondition),
      );
    }
  }
  else if (whereQueryData) {
    const whereConditions = prepareWhereQueryConditions(table, whereQueryData);
    if (whereConditions && whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }
  }

  const recordsCount = await countQuery;
  const total_records = recordsCount[0]?.total || 0;
  const total_pages = Math.ceil(total_records / pageSize) || 1;

  const pagination_info: PaginationInfo = {
    total_records,
    total_pages,
    page_size: pageSize,
    current_page: page > total_pages ? total_pages : page,
    next_page: page >= total_pages ? null : page + 1,
    prev_page: page <= 1 ? null : page - 1,
  };

  if (total_records === 0) {
    return {
      pagination_info,
      records: [],
    };
  }

  const columnsRequired = prepareSelectColumnsForQuery(table, columnsToSelect);
  const whereConditions = prepareWhereQueryConditions(table, whereQueryData);
  const orderByConditions = prepareOrderByQueryConditions(
    table,
    orderByQueryData,
  );
  const inQueryCondition = prepareInQueryCondition(table, inQueryData);

  const whereQuery = whereConditions ? and(...whereConditions) : null;

  const paginationData = { page, pageSize };
  const results = await executeQuery<R, C>(
    table,
    whereQuery,
    columnsRequired,
    orderByConditions,
    inQueryCondition,
    paginationData,
    trx,
  );

  return {
    pagination_info,
    records: results,
  };
}

async function getMultipleRecordsByAColumnValue<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  column: C,
  value: any,
  columnsToSelect?: any,
  orderByQueryData?: OrderByQueryData<R>,
  inQueryData?: InQueryData<R>,
) {
  const whereQueryData: WhereQueryData<R> = {
    columns: [column],
    values: [value],
  };

  const results = await getRecordsConditionally<R, C>(
    table,
    whereQueryData,
    columnsToSelect,
    orderByQueryData,
    inQueryData,
  );
  return results;
}

async function getMultipleRecordsByMultipleColumnValues<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  columns: C[],
  values: any[],
  columnsToSelect?: any,
  orderByQueryData?: OrderByQueryData<R>,
  inQueryData?: InQueryData<R>,
) {
  const whereQueryData: WhereQueryData<R> = {
    columns,
    values,
  };

  const results = await getRecordsConditionally<R, C>(
    table,
    whereQueryData,
    columnsToSelect,
    orderByQueryData,
    inQueryData,
  );

  // if (!results) {
  //   return null;
  // }
  return results;
}

async function getSingleRecordByAColumnValue<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  column: C,
  value: any,
  columnsToSelect?: any,
  orderByQueryData?: OrderByQueryData<R>,
  inQueryData?: InQueryData<R>,
) {
  const whereQueryData: WhereQueryData<R> = {
    columns: [column],
    values: [value],
  };

  const results = await getRecordsConditionally<R, C>(
    table,
    whereQueryData,
    columnsToSelect,
    orderByQueryData,
    inQueryData,
  );

  if (!results) {
    return null;
  }
  return results[0];
}

async function getSingleRecordByMultipleColumnValues<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  columns: C[],
  values: any[],
  columnsToSelect?: any,
  orderByQueryData?: OrderByQueryData<R>,
  inQueryData?: InQueryData<R>,
) {
  const whereQueryData: WhereQueryData<R> = {
    columns,
    values,
  };

  const results = await getRecordsConditionally<R, C>(
    table,
    whereQueryData,
    columnsToSelect,
    orderByQueryData,
    inQueryData,
  );

  if (!results) {
    return null;
  }
  return results[0];
}

// with trx
async function getSingleRecordByMultipleColumnValueswithtrx<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  columns: C[],
  values: any[],
  trx?: Transaction,
  columnsToSelect?: any,
  orderByQueryData?: OrderByQueryData<R>,
  inQueryData?: InQueryData<R>,

) {
  const whereQueryData: WhereQueryData<R> = {
    columns,
    values,
  };

  const results = await getRecordsConditionally<R, C>(
    table,
    whereQueryData,
    columnsToSelect,
    orderByQueryData,
    inQueryData,
    trx,
  );

  if (!results) {
    return null;
  }
  return results[0];
}

async function saveSingleRecord<R extends DBTableRow>(table: DBTable, record: DBNewRecord, trx?: Transaction) {
  const client = trx ?? db;
  const dataWithTimeStamps = {
    ...record,
    created_at: new Date(),
  };

  const recordSaved = await client
    .insert(table)
    .values({
      ...dataWithTimeStamps,
    })
    .returning();

  return recordSaved[0] as R;
}

async function saveRecords<R extends DBTableRow>(
  table: DBTable,
  records: DBNewRecords,
) {
  const recordsSaved = await db.insert(table).values(records).returning();
  return recordsSaved as R[];
}
// with trx
async function saveRecordswithtrx<R extends DBTableRow>(
  table: DBTable,
  records: DBNewRecords,
  trx?: Transaction,
) {
  const client = trx ?? db; // use trx if provided, else fallback to db

  const recordsSaved = await client.insert(table).values(records).returning();
  return recordsSaved as R[];
}

async function deleteRecordById<R extends DBTableRow>(
  table: DBTable,
  id: number,
) {
  const deletedRecord = await db
    .delete(table)
    .where(eq(table.id, id))
    .returning();
  return deletedRecord[0] as R;
}

async function exportData(table: DBTable, projection?: any, filters?: any) {
  const initialQuery = db.select(projection).from(table);
  let finalQuery;
  if (filters && filters.length > 0) {
    finalQuery = initialQuery.where(and(...filters));
  }
  const result = await finalQuery;
  return result;
}

async function getPaginatedRecords(
  table: DBTable,
  skip: number,
  limit: number,
  filters?: any,
  sorting?: any,
  projection?: any,
) {
  let initialQuery: any = db.select(projection).from(table);

  if (filters && filters.length > 0) {
    initialQuery = initialQuery.where(and(...filters));
  }

  if (sorting) {
    const columnExpression = (table as any)[sorting.sort_by];
    if (sorting.sort_type === "asc") {
      initialQuery = initialQuery.orderBy(asc(columnExpression));
    }
    else {
      initialQuery = initialQuery.orderBy(desc(columnExpression));
    }
  }
  else {
    initialQuery = initialQuery.orderBy(desc(table.created_at));
  }

  const result = await initialQuery.limit(limit).offset(skip);
  return result;
}

// without trx
async function getRecordsCount(
  table: DBTable,
  filters?: any,
) {
  const initialQuery = db.select({ total: count() }).from(table);

  let finalQuery;
  if (filters && filters.length > 0) {
    finalQuery = initialQuery.where(and(...filters));
  }
  else {
    finalQuery = initialQuery;
  }

  const result = await finalQuery;
  return result[0]?.total ?? 0;
}

// with trx
async function getRecordsCountwithtrx(
  table: DBTable,
  filters?: any,
  trx?: Transaction,
) {
  const dbInstance = trx ?? db;

  const initialQuery = dbInstance.select({ total: count() }).from(table);

  let finalQuery;
  if (filters && filters.length > 0) {
    finalQuery = initialQuery.where(and(...filters));
  }
  else {
    finalQuery = initialQuery;
  }

  const result = await finalQuery;
  return result[0]?.total ?? 0;
}

async function updateRecordByColumnValue<R extends DBTableRow>(
  table: DBTable,
  column: string,
  value: string | number,
  record: UpdateRecordData<R>,
  id?: number,
) {
  const dataWithTimeStamps = { id, ...record, updated_at: new Date() };
  const columnInfo = sql.raw(`${getTableName(table)}.${column}`);
  return await db
    .update(table)
    .set(dataWithTimeStamps)
    .where(eq(columnInfo, value));
}
// with trx
async function updateRecordByColumnValuewithtrx<R extends DBTableRow>(
  table: DBTable,
  column: string,
  value: string | number,
  record: UpdateRecordData<R>,
  trx?: Transaction,
  extraCondition?: { column: string; operator: "IN" | "="; value: any },
): Promise<R> {
  const client = trx ?? db;

  const dataWithTimeStamps = {
    ...record,
    updated_at: new Date(),
  };

  const conditions = [eq((table as any)[column], value)];

  if (extraCondition) {
    if (extraCondition.operator === "IN") {
      conditions.push(
        inArray((table as any)[extraCondition.column], extraCondition.value),
      );
    }
    else {
      conditions.push(
        eq((table as any)[extraCondition.column], extraCondition.value),
      );
    }
  }

  const [updatedRecord] = await client
    .update(table)
    .set(dataWithTimeStamps)
    .where(and(...conditions))
    .returning();

  return updatedRecord as R;
}

async function updateRecordById<R extends DBTableRow>(
  table: DBTable,
  id: number,
  record: UpdateRecordData<R>,
  trx?: Transaction,
) {
  const client = trx ?? db;

  const dataWithTimeStamps = {
    id,
    ...record,
    updated_at: new Date(),
  };

  const recordUpdated = await client
    .update(table)
    .set(dataWithTimeStamps)
    .where(eq(table.id, id))
    .returning();

  return recordUpdated[0] as R;
}
// withtrx
async function updateRecordByIdwithtrx<R extends DBTableRow>(
  table: DBTable,
  id: number,
  record: UpdateRecordData<R>,
  trx?: Transaction,
): Promise<R | null> {
  const client = trx ?? db; // Use transaction if provided, else fallback to db

  const dataWithTimeStamps = {
    ...record,
    updated_at: new Date(),
  };

  const result = await client
    .update(table)
    .set(dataWithTimeStamps)
    .where(eq(table.id, id))
    .returning();

  return result.length > 0 ? (result[0] as R) : null;
}

async function updateRecordByMultipleColumnValues<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  columns: C[],
  values: any[],
  record: UpdateRecordData<R>,
  id?: number,
  trx?: Transaction,
) {
  const client = trx ?? db;

  const dataWithTimeStamps = { id, ...record, updated_at: new Date() };

  // ✅ Build conditions with IN support
  const whereConditions = columns.map((column, index) => {
    const value = values[index];

    if (Array.isArray(value)) {
      // If value is an array → use IN condition
      return inArray((table as any)[column], value);
    }

    // Otherwise → normal equality
    return eq((table as any)[column], value);
  });

  return await client
    .update(table)
    .set(dataWithTimeStamps)
    .where(and(...whereConditions))
    .returning(); // return updated rows
}

async function updateMultipleRecordsByIds<R extends DBTableRow>(
  table: DBTable,
  ids: number[],
  record: Partial<R>,
) {
  const updatedRecords = await db
    .update(table)
    .set(record)
    .where(inArray(table.id, ids))
    .returning();

  return updatedRecords.length;
}

async function deleteRecordsByColumn<T>(table: any, column: keyof T, value: any) {
  return await db.delete(table).where(eq(table[column], value));
}

// ../services/db/baseDbService.ts

async function softDeleteRecordById<R extends DBTableRow>(
  table: DBTable,
  id: number,
  record: UpdateRecordData<R>,
) {
  return await db.update(table).set(record).where(eq(table.id, id)).returning();
}

async function saveSingleRecordWithTrx<R extends DBTableRow>(
  table: DBTable,
  record: DBNewRecord,
  trx?: Transaction, // ← optional trx
) {
  const client = trx ?? db; // ← fallback to db if trx not passed

  const dataWithTimeStamps = {
    ...record,
    created_at: new Date(),
  };
  const recordSaved = await client.insert(table).values(dataWithTimeStamps).returning();
  return recordSaved[0] as R;
}

async function saveRecordsWithTrx<R extends DBTableRow>(
  table: DBTable,
  records: DBNewRecords,
  trx?: Transaction,
) {
  const client = trx ?? db;

  // Always handle as array - convert single record to array if needed
  const recordsArray = Array.isArray(records) ? records : [records];

  const recordsWithTimeStamps = recordsArray.map(record => ({
    ...record,
    created_at: new Date(),
  }));

  const recordsSaved = await client.insert(table).values(recordsWithTimeStamps).returning();
  return recordsSaved as R[];
}

async function softDeleteRecordByIdWithTrx<R extends DBTableRow>(
  table: DBTable,
  id: number,
  record: UpdateRecordData<R>,
  trx?: Transaction,
) {
  const client = trx ?? db;
  return await client.update(table).set(record).where(eq(table.id, id)).returning();
}

async function updateRecordByMultipleColumnValuesWithTrx<
  R extends DBTableRow,
  C extends keyof R = keyof R,
>(
  table: DBTable,
  columns: C[],
  values: any[],
  record: UpdateRecordData<R>,
  trx?: Transaction,
  id?: number,

) {
  const client = trx ?? db;

  const whereQueryData: WhereQueryData<R> = {
    columns,
    values,
  };

  const dataWithTimeStamps = { id, ...record, updated_at: new Date() };
  const whereConditions = whereQueryData.columns.map((column, index) =>
    eq(
      sql.raw(`${getTableName(table)}.${String(column)}`),
      whereQueryData.values[index],
    ),
  );

  return await client
    .update(table)
    .set(dataWithTimeStamps)
    .where(and(...whereConditions));
}

export {
  deleteRecordById,
  deleteRecordsByColumn,
  exportData,
  getMultipleRecordsByAColumnValue,
  getMultipleRecordsByMultipleColumnValues,
  getPaginatedRecords,
  getPaginatedRecordsConditionally,
  getPaginatedRecordsConditionallywithtrx,
  getRecordById,
  getRecordsConditionally,
  getRecordsCount,
  getRecordsCountwithtrx,
  getSingleRecordByAColumnValue,
  getSingleRecordByMultipleColumnValues,
  getSingleRecordByMultipleColumnValueswithtrx,
  saveRecords,
  saveRecordswithtrx,
  saveRecordsWithTrx,
  saveSingleRecord,
  saveSingleRecordWithTrx,
  softDeleteRecordById,
  softDeleteRecordByIdWithTrx,
  updateMultipleRecordsByIds,
  updateRecordByColumnValue,
  updateRecordByColumnValuewithtrx,
  updateRecordById,
  updateRecordByIdwithtrx,
  updateRecordByMultipleColumnValues,
  updateRecordByMultipleColumnValuesWithTrx,
};
