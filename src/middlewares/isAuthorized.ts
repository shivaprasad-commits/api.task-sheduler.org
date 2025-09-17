import type { Context } from "hono";

import { createMiddleware } from "hono/factory";

import { getUserDetailsFromToken } from "../utils/jwtUtils.js";
import { sendErrorResp } from "../utils/respUtils.js";

const isAuthorized = createMiddleware(async (c: Context, next) => {
  const userDetails = await getUserDetailsFromToken(c);
  c.set("user_payload", userDetails);
  await next();
});

const isOptionalAuthorized = createMiddleware(async (c: Context, next) => {
  const isPublic = c.req.query("is_public") || "false";
  if (isPublic && isPublic === "true") {
    await next();
  }
  else {
    const userDetails = await getUserDetailsFromToken(c);
    c.set("user_payload", userDetails);
    await next();
  }
});

const isEmployee = createMiddleware(async (c: Context, next) => {
  try {
    const userDetails = await getUserDetailsFromToken(c);

    if (userDetails.user_type === "EMPLOYEE") {
      c.set("user_payload", userDetails);
      await next();
    }
    else {
      return sendErrorResp(c, 403, "Access denied");
    }
  }
  catch (error) {
    throw error;
  }
});

const isManagerOrAdmin = createMiddleware(async (c: Context, next) => {
  try {
    const userDetails = await getUserDetailsFromToken(c);

    if (userDetails.user_type === "ADMIN" || userDetails.user_type === "MANAGER") {
      c.set("user_payload", userDetails);
      await next();
    }
    else {
      return sendErrorResp(c, 403, "Access denied");
    }
  }
  catch (error) {
    throw error;
  }
});

export { isAuthorized, isEmployee, isManagerOrAdmin, isOptionalAuthorized };
