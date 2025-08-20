import {nonEmpty,minLength,object,optional,string,integer,number,pipe,pipeAsync, custom, array} from "valibot";
import {TASK_TITLE_INVALID,TASK_TITLE_MISSING,TASK_TITLE_TOO_SHORT,TASK_DESC_INVALID,TASK_SUBTASKS_INVALID,TASK_STATUS_INVALID,TASK_STATUS_MISSING,TASK_START_DATE_INVALID,TASK_DUE_DATE_INVALID,TASK_USER_ID_INVALID,TASK_PROJECT_ID_INVALID,TASK_USER_ID_MISSING,TASK_PROJECT_ID_MISSING,TASK_START_DATE_MISSING,TASK_DUE_DATE_MISSING,TASK_SUBTASKS_MISSING} from "../../constants/appMessages";
import UnprocessableContentException from "../../exceptions/unprocessableContentException";
const allowedTaskStatuses = ["COMPLETED", "IN_PROGRESS", "PENDING", "IN_REVIEW","OVER_DUE"];

export const VCreateTaskSchema = pipeAsync(
  object({
    project_id: pipe(
      number(),
      integer(),
      custom((value: unknown) => {
        if (value === undefined || value === null) {
          throw new UnprocessableContentException(TASK_PROJECT_ID_MISSING);
        }
        return true;
      }, TASK_PROJECT_ID_MISSING),
    ),
    title: pipe(
      string(TASK_TITLE_INVALID),
      nonEmpty(TASK_TITLE_MISSING),
      minLength(3, TASK_TITLE_TOO_SHORT),
    ),
    created_by: pipe(   
      number(TASK_USER_ID_INVALID),
      integer(TASK_USER_ID_INVALID),
      
    ),
    description: string(TASK_DESC_INVALID), 
    sub_tasks: pipe(
      array(string(TASK_SUBTASKS_INVALID)),
      nonEmpty(TASK_SUBTASKS_MISSING),
    ),
    start_date: pipe(
      string(TASK_START_DATE_INVALID),
      nonEmpty(TASK_START_DATE_MISSING),
    ),
    due_date: pipe(
      string(TASK_DUE_DATE_INVALID),
      nonEmpty(TASK_DUE_DATE_MISSING),
    ),
    status: pipe(
      string(TASK_STATUS_INVALID),
      nonEmpty(TASK_STATUS_MISSING),
      custom((value: unknown) => {
        if (
          typeof value !== "string" ||
          !allowedTaskStatuses.includes(value as (typeof allowedTaskStatuses)[number])
        ) {
          throw new UnprocessableContentException(TASK_STATUS_INVALID);
        }
        return true;
      }, TASK_STATUS_INVALID),
    ),
  }),
);

