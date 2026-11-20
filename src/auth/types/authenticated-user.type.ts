import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * The user that JwtStrategy attaches to request.user: the public user
 * data (read from the database on every request) plus the session id.
 */
export type AuthenticatedUser = UserResponseDto & { sid: string };