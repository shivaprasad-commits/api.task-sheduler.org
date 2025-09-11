import type { InferSelectModel } from "drizzle-orm";
import type { Context } from "hono";
import type {
  DBTableColumns,
  OrderByQueryData,
  SortDirection,
  WhereQueryData,
} from "../types/dbTypes.js";
import {
  USERS_FETCHED,
  FAILED_TO_FETCH_USERS,
  EMPLOYEES_FETCHED,
  USER_VALIDATION_ERROR,
  USER_NOT_FOUND,
  USER_FETCHED,
  FAILED_TO_UPDATE_USER,
  INVALID_INPUT,
  USER_UPDATED,
} from "../constants/appMessages.js";
import { users } from "../db/schema/users.js";
import {
  getPaginatedRecordsConditionally,
  getRecordsConditionally,
  getSingleRecordByMultipleColumnValues,
  updateRecordById,
  getRecordById,
  getSingleRecordByAColumnValue,
} from "../services/db/baseDbService.js";
import { sendSuccessResp } from "../utils/respUtils.js";
import { PgTableWithColumns, PgColumn } from "drizzle-orm/pg-core";
import BadRequestException from "../exceptions/badRequestException.js";
import { validateRequest } from "../validations/validateRequest.js";
import ConflictException from "../exceptions/conflictException.js";


import { saveSingleRecord } from "../services/db/baseDbService.js";
import type { ValidatedCreateUserOrAdmin } from "../validations/schemas/vUserSchema.js";
import { VCreateUserSchema } from "../validations/schemas/vUserSchema.js";
import { InferOutput, parseAsync } from "valibot";
import { VUpdateUserSchema } from "../validations/schemas/vUserSchema.js";
import { ValidatedUpdateUser } from "../validations/schemas/vUserSchema.js";
import NotFoundException from "./../exceptions/notFoundException";


import { buildUserQueryData } from "../helpers/userHelper.js";

type User = InferSelectModel<typeof users>;

export class UsersController {
  // 1. Get paginated users
  getPaginatedUsers = async (c: Context) => {
  try {
    const page = +(c.req.query("page") || 1);
    const pageSize = +(c.req.query("page_size") || 10);
    const searchString = c.req.query("search_string")?.trim() || null;
    const orderBy = c.req.query("order_by");
    const userType = c.req.query("user_type");

    // Default filters
    const filters: Partial<User> = {
      user_status: "ACTIVE",
    };
    if (userType) filters.user_type = userType as any;

    // Build query data using your helper
    const { orderByQueryData, whereQueryData } = buildUserQueryData<User>(
      searchString,
      orderBy ?? null,
      filters,
      "display_name" // default search column
    );

    // Fetch paginated users
    const result = await getPaginatedRecordsConditionally<User>(
      users,
      page,
      pageSize,
      orderByQueryData as any,
      whereQueryData as any
    );

    return sendSuccessResp(c, 200, USERS_FETCHED, result);
  } catch (err) {
    console.error("Error fetching paginated users:", err);
    return c.json({ message: "Failed to fetch users" }, 500);
  }
};
  // 2. Dropdown list (id + full_name only)
  getUsersDropdown = async (c: Context) => {
    try {
      const searchString = c.req.query("search_string")?.trim() || null;

      const whereQueryData: WhereQueryData<User> = {
        columns: ["user_status"],
        values: ["ACTIVE"],
      };
      if (searchString) {
        whereQueryData.columns.push("display_name");
        whereQueryData.values.push(`%${searchString}%`);
      }

      const result = await getRecordsConditionally<User>(
        users,
        whereQueryData,
        ["id", "display_name"],
        { columns: ["created_at"], values: ["asc"] }
      );

      return sendSuccessResp(c, 200, USERS_FETCHED, result);
    } catch (err) {
      throw new BadRequestException(FAILED_TO_FETCH_USERS);
    }
  };

  // 3. Employees list (exclude admins) with pagination
  getEmployeesList = async (c: Context) => {
    const page = +c.req.query("page")! || 1;
    const pageSize = +c.req.query("page_size")! || 10;
    const searchString = c.req.query("search_string")?.trim() || null;

    const whereQueryData: WhereQueryData<User> = {
      columns: ["user_type"],
      values: ["EMPLOYEE"],
    };

    if (searchString) {
      whereQueryData.columns.push("display_name");
      whereQueryData.values.push(`%${searchString}%`);
    }

    const result = await getPaginatedRecordsConditionally<User>(
      users,
      page,
      pageSize,
      { columns: ["created_at"], values: ["desc"] },
      whereQueryData
    );

    return sendSuccessResp(c, 200, EMPLOYEES_FETCHED, result);
  };
  // //Add user
  // updateInternalUser = async (c: Context) => {
  //   const id = +c.req.param("id");
  //   const req = await c.req.json();

  //   if (!id) {
  //     throw new BadRequestException(INVALID_INPUT);
  //   }

  //   const user = await getRecordById<User>(users, id);
  //   if (!user || user.deleted_at !== null || user.user_status !== "ACTIVE") {
  //     throw new NotFoundException(USER_NOT_FOUND);
  //   }

  //   const validatedUser: ValidatedUpdateUser = await validateRequest(
  //     "update-user",
  //     req,
  //     "VUpdateUserSchema"
  //   );

  //   const updatedUser = await updateRecordById<User>(users, id, {
  //     user_name: validatedUser.user_name,
  //     email: validatedUser.email,
  //     phone: validatedUser.phone,
  //   });

  //   return sendSuccessResp(c, 200, USER_UPDATED, updatedUser);
  // };
  // get single user by id
  getUserById = async (c: Context) => {
    const userId = Number(c.req.param("id"));

    const user = await getSingleRecordByMultipleColumnValues<User>(
      users,
      ["id", "deleted_at"],
      [userId, null]
    );

    if (!user) {
      throw new NotFoundException(USER_NOT_FOUND);
    }

    return sendSuccessResp(c, 200, USER_FETCHED, user);
  };

  // edit user by id
  editUser = async (c: Context) => {
    try {
      const userId = Number(c.req.param("id"));
      if (isNaN(userId) || userId <= 0) {
        throw new BadRequestException("Invalid user ID");
      }

      const requestBody = await c.req.json();

      const existingUser = await getSingleRecordByMultipleColumnValues<User>(
        users,
        ["id", "deleted_at"],
        [userId, null]
      );

      if (!existingUser) {
        throw new NotFoundException(USER_NOT_FOUND);
      }

      const validatedReq = await parseAsync(VCreateUserSchema, requestBody);

      await updateRecordById<User>(users, userId, validatedReq);

      const updatedUser = await getSingleRecordByMultipleColumnValues<User>(
        users,
        ["id", "deleted_at"],
        [userId, null]
      );

      return sendSuccessResp(c, 200, USER_UPDATED, updatedUser);
    } catch (err) {
      throw new BadRequestException(FAILED_TO_UPDATE_USER);
    }
  };

  // create user
  addUser = async (c: Context) => {
    const body = await c.req.json();

    const validated = await validateRequest<ValidatedCreateUserOrAdmin >(
      "create-user",
      body,
      "VUserCreateSchema"
    );

    const existingUser = await getSingleRecordByAColumnValue<User>(users, "email", validated.email);
    if (existingUser) {
      throw new ConflictException("User already exists with this email");
    }

    const defaultPassword = "123456";

    const newUser = await saveSingleRecord<User>(users, {
      ...validated,
      password: defaultPassword,
    });

    return sendSuccessResp(c, 201, "User created successfully", newUser);
  };
}

export default UsersController;
