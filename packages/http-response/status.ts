const Successful = {
  Ok: 200,
  Created: 201,
  NoContent: 204,
} as const;

const Redirection = {
  PermanentRedirect: 308,
} as const;

const ClientError = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  TooManyRequests: 429,
} as const;

const ServerError = {
  InternalServerError: 500,
} as const;

export const Status = {
  ...Successful,
  ...Redirection,
  ...ClientError,
  ...ServerError,
};

type SuccessfulStatus = (typeof Successful)[keyof typeof Successful];
type RedirectionStatus = (typeof Redirection)[keyof typeof Redirection];

export type SuccessStatus = SuccessfulStatus | RedirectionStatus;

type ClientErrorStatus = (typeof ClientError)[keyof typeof ClientError];
type ServerErrorStatus = (typeof ServerError)[keyof typeof ServerError];

export type ErrorStatus = ClientErrorStatus | ServerErrorStatus;
