/**
 * Response DTO for the collaborators endpoint.
 * Represents a user who has contributed approved pages to a work.
 */
export class CollaboratorDto {
  /** The unique identifier of the user */
  userId: string;

  /** The username of the user */
  username: string;

  /** The number of approved pages contributed by this user */
  pageCount: number;
}
