import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Project } from "../db/schema/projects.js";
import type { User } from "../db/schema/users.js";
import type { ProjectUser, ProjectWithUsersResponse } from "../types/appTypes.js";
import type { WhereQueryData } from "../types/dbTypes.js";

import { allowedProjectStatus } from "../constants/appMessages.js";
import { db } from "../db/configuration.js";
import { projects } from "../db/schema/projects.js";
import { user_projects } from "../db/schema/userProjects.js";

// filters
export function buildProjectFilters(search?: string, projectStatus?: any): any[] {
  const filters: any[] = [isNull(projects.deleted_at)];

  if (search?.trim()) {
    filters.push(sql`LOWER(${projects.title}) LIKE LOWER(${`%${search.trim()}%`})`);
  }

  if (projectStatus && allowedProjectStatus.includes(projectStatus.toUpperCase())) {
    filters.push(eq(projects.project_status, projectStatus.toUpperCase() as any));
  }

  return filters;
}

// projects orderby
export function buildOrderByClause(orderBy?: string): any {
  if (!orderBy) {
    return desc(projects.created_at);
  }

  const [column, direction] = orderBy.split(":");
  const dir = direction?.toLowerCase() === "desc" ? "desc" : "asc";

  return dir === "desc"
    ? sql`${sql.identifier(column)} DESC`
    : sql`${sql.identifier(column)} ASC`;
}

// projects with users
export function mapProjectsWithUsers(projects: any[]): ProjectWithUsersResponse[] {
  return projects.map((project: any) => ({
    projectId: project.id,
    projectName: project.title,
    project_start_date: project.start_date,
    project_end_date: project.end_date,
    projectLogoUrl: project.logo_url,
    projectStatus: project.project_status,
    users: project.userProjects
      .filter((userProject: any) => userProject.users)
      .map((userProject: any): ProjectUser => ({
        user_id: userProject.users.id,
        display_name: userProject.users.display_name,
      })),
  }));
}

// Updated buildProjectsWhereQueryData function
async function getUserAssignedProjectIds(userId: number): Promise<number[]> {
  const userProjects = await db
    .select({ project_id: user_projects.project_id })
    .from(user_projects)
    .where(
      and(
        eq(user_projects.user_id, userId),
        isNull(user_projects.deleted_at),
      ),
    );

  return userProjects.map(up => up.project_id).filter(id => id !== null) as number[];
}

export async function buildProjectsWhereQueryData(
  startDate: string | null,
  endDate: string | null,
  projectStatus: string | null,
  searchString: string | null,
  user: User,
) {
  const whereQueryData: WhereQueryData<Project> = {
    columns: ["deleted_at"],
    values: [null],
  };

  if (searchString) {
    whereQueryData.columns.push("title");
    whereQueryData.values.push(`%${searchString}%`);
  }

  if (projectStatus?.toUpperCase()) {
    whereQueryData.columns.push("project_status");
    whereQueryData.values.push(projectStatus.toUpperCase());
  }

  if (startDate || endDate) {
    whereQueryData.columns.push("due_date");
    const dateFilter: { gte?: Date; lte?: Date } = {};

    if (startDate) {
      dateFilter.gte = new Date(`${startDate}T00:00:00`);
    }
    if (endDate) {
      dateFilter.lte = new Date(`${endDate}T23:59:59`);
    }
    whereQueryData.values.push(dateFilter);
  }

  if (user.user_type === "EMPLOYEE") {
    const projectIds = await getUserAssignedProjectIds(user.id);

    // Only add the condition if there are project IDs
    if (projectIds.length > 0) {
      whereQueryData.columns.push("id");
      whereQueryData.values.push(projectIds); // Use IN condition
    }
  }

  return whereQueryData;
}
