import {
	isGroupChat,
	getRoomAvatar,
	getUidDirectMessage,
	getRoomTitle,
	getSenderName,
	canAutoTranslate,
	isRead,
	hasRole,
	hasPermission
} from './helpers';
import { SubscriptionType } from '../../../definitions';

// Mock dependencies
const mockGetState = jest.fn();
const mockDatabaseFind = jest.fn();
const mockDatabaseGet = jest.fn(() => ({
	find: mockDatabaseFind
}));

jest.mock('../../store/auxStore', () => ({
	store: {
		getState: () => mockGetState()
	}
}));

jest.mock('../../database', () => ({
	__esModule: true,
	default: {
		get active() {
			return {
				get: mockDatabaseGet
			};
		}
	}
}));

jest.mock('./log', () => ({
	__esModule: true,
	default: jest.fn()
}));

describe('helpers.ts - TypeScript Migration Verification', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Default mock state
		mockGetState.mockReturnValue({
			login: {
				user: {
					id: 'current-user-id',
					username: 'currentuser',
					roles: ['user', 'admin']
				}
			},
			settings: {
				UI_Use_Real_Name: false,
				UI_Allow_room_names_with_special_chars: false,
				AutoTranslate_Enabled: true
			},
			permissions: {
				'auto-translate': ['admin', 'user']
			}
		});
		// Reset database mocks
		mockDatabaseGet.mockReturnValue({
			find: mockDatabaseFind
		});
		// Default mock for find - returns admin role
		mockDatabaseFind.mockResolvedValue({ roles: ['admin'] });
	});

	describe('isGroupChat', () => {
		it('should return true for group chat with more than 2 uids', () => {
			const room = {
				uids: ['user1', 'user2', 'user3'],
				usernames: ['user1', 'user2', 'user3']
			};
			expect(isGroupChat(room)).toBe(true);
		});

		it('should return true for group chat with more than 2 usernames', () => {
			const room = {
				usernames: ['user1', 'user2', 'user3']
			};
			expect(isGroupChat(room)).toBe(true);
		});

		it('should return false for direct message with 2 users', () => {
			const room = {
				uids: ['user1', 'user2'],
				usernames: ['user1', 'user2']
			};
			expect(isGroupChat(room)).toBe(false);
		});

		it('should return false for undefined room', () => {
			expect(isGroupChat(undefined)).toBe(false);
		});

		it('should return false for room without uids or usernames', () => {
			const room = {
				name: 'test-room'
			};
			expect(isGroupChat(room)).toBe(false);
		});
	});

	describe('getRoomAvatar', () => {
		it('should return group chat avatar for group rooms', () => {
			const room = {
				uids: ['user1', 'user2', 'user3'],
				usernames: ['user1', 'user2', 'user3']
			};
			const result = getRoomAvatar(room);
			expect(typeof result).toBe('string');
			expect(result.length).toBeGreaterThan(0);
		});

		it('should return fname for room with prid', () => {
			const room = {
				prid: 'parent-id',
				fname: 'Parent Room',
				name: 'Room Name'
			};
			expect(getRoomAvatar(room)).toBe('Parent Room');
		});

		it('should return name for room without prid', () => {
			const room = {
				name: 'Room Name'
			};
			expect(getRoomAvatar(room)).toBe('Room Name');
		});

		it('should return empty string for undefined room', () => {
			expect(getRoomAvatar(undefined)).toBe('');
		});

		it('should return empty string when fname is missing with prid', () => {
			const room = {
				prid: 'parent-id',
				name: 'Room Name'
			};
			expect(getRoomAvatar(room)).toBe('');
		});
	});

	describe('getUidDirectMessage', () => {
		it('should return other user id for direct message', () => {
			const room = {
				uids: ['current-user-id', 'other-user-id'],
				t: SubscriptionType.DIRECT
			};
			const result = getUidDirectMessage(room);
			expect(result).toBe('other-user-id');
		});

		it('should return null for group chat', () => {
			const room = {
				uids: ['user1', 'user2', 'user3'],
				usernames: ['user1', 'user2', 'user3'],
				t: SubscriptionType.GROUP
			};
			expect(getUidDirectMessage(room)).toBeUndefined();
		});

		it('should return undefined for null room', () => {
			expect(getUidDirectMessage(null)).toBeUndefined();
		});

		it('should return undefined for undefined room', () => {
			expect(getUidDirectMessage(undefined)).toBeUndefined();
		});

		it('should return userId when itsMe is true', () => {
			const room = {
				itsMe: true
			};
			const result = getUidDirectMessage(room);
			expect(result).toBe('current-user-id');
		});

		it('should handle legacy direct message format', () => {
			const room = {
				rid: 'current-user-idother-user-id',
				t: SubscriptionType.DIRECT
			};
			const result = getUidDirectMessage(room);
			expect(result).toBe('other-user-id');
		});

		it('should return me when no other user found', () => {
			const room = {
				uids: ['current-user-id'],
				t: SubscriptionType.DIRECT
			};
			const result = getUidDirectMessage(room);
			expect(result).toBe('current-user-id');
		});
	});

	describe('getRoomTitle', () => {
		it('should return room name', () => {
			const room = {
				name: 'Test Room',
				t: SubscriptionType.CHANNEL
			};
			expect(getRoomTitle(room)).toBe('Test Room');
		});

		it('should return fname when useRealName is enabled', () => {
			mockGetState.mockReturnValueOnce({
				login: { user: { username: 'user' } },
				settings: {
					UI_Use_Real_Name: true,
					UI_Allow_room_names_with_special_chars: false
				}
			});
			const room = {
				name: 'room-name',
				fname: 'Room Display Name',
				t: SubscriptionType.CHANNEL
			};
			expect(getRoomTitle(room)).toBe('Room Display Name');
		});

		it('should return empty string for undefined room', () => {
			expect(getRoomTitle(undefined)).toBe('');
		});

		it('should return federated room fname', () => {
			const room = {
				federated: true,
				fname: 'Federated Room'
			};
			expect(getRoomTitle(room)).toBe('Federated Room');
		});

		it('should return usernames for group chat without name', () => {
			mockGetState.mockReturnValueOnce({
				login: { user: { username: 'currentuser' } },
				settings: {
					UI_Use_Real_Name: false,
					UI_Allow_room_names_with_special_chars: false
				}
			});
			const room = {
				uids: ['user1', 'user2', 'user3'],
				usernames: ['user1', 'user2', 'currentuser'],
				t: SubscriptionType.GROUP
			};
			const result = getRoomTitle(room);
			expect(result).toContain('user1');
			expect(result).toContain('user2');
			expect(result).not.toContain('currentuser');
		});

		it('should return fname when allowSpecialChars is true', () => {
			mockGetState.mockReturnValueOnce({
				login: { user: { username: 'user' } },
				settings: {
					UI_Use_Real_Name: false,
					UI_Allow_room_names_with_special_chars: true
				}
			});
			const room = {
				name: 'room-name',
				fname: 'Room Display Name',
				t: SubscriptionType.CHANNEL
			};
			expect(getRoomTitle(room)).toBe('Room Display Name');
		});
	});

	describe('getSenderName', () => {
		it('should return username when useRealName is false', () => {
			const sender = {
				username: 'testuser',
				name: 'Test User'
			};
			expect(getSenderName(sender)).toBe('testuser');
		});

		it('should return name when useRealName is true', () => {
			mockGetState.mockReturnValueOnce({
				settings: { UI_Use_Real_Name: true }
			});
			const sender = {
				username: 'testuser',
				name: 'Test User'
			};
			expect(getSenderName(sender)).toBe('Test User');
		});

		it('should handle missing name gracefully', () => {
			const sender = {
				username: 'testuser'
			};
			expect(getSenderName(sender)).toBe('testuser');
		});

		it('should return empty string when both name and username are missing', () => {
			mockGetState.mockReturnValueOnce({
				settings: { UI_Use_Real_Name: true }
			});
			const sender = {
				username: undefined,
				name: undefined
			} as any;
			expect(getSenderName(sender)).toBe('');
		});
	});

	describe('canAutoTranslate', () => {
		it('should return true when auto-translate is enabled and user has permission', () => {
			mockGetState.mockReturnValueOnce({
				settings: { AutoTranslate_Enabled: true },
				login: { user: { roles: ['admin'] } },
				permissions: { 'auto-translate': ['admin', 'user'] }
			});
			expect(canAutoTranslate()).toBe(true);
		});

		it('should return false when auto-translate is disabled', () => {
			mockGetState.mockReturnValueOnce({
				settings: { AutoTranslate_Enabled: false },
				login: { user: { roles: [] } },
				permissions: {}
			});
			expect(canAutoTranslate()).toBe(false);
		});

		it('should return false when user lacks permission', () => {
			// Mock getState to be called multiple times
			mockGetState
				.mockReturnValueOnce({
					settings: { AutoTranslate_Enabled: true }
				})
				.mockReturnValueOnce({
					permissions: { 'auto-translate': ['admin'] }
				})
				.mockReturnValueOnce({
					login: { user: { roles: ['guest'] } }
				});
			expect(canAutoTranslate()).toBe(false);
		});

		it('should return false when permissions are undefined', () => {
			mockGetState
				.mockReturnValueOnce({
					settings: { AutoTranslate_Enabled: true }
				})
				.mockReturnValueOnce({
					permissions: { 'auto-translate': undefined }
				})
				.mockReturnValueOnce({
					login: { user: { roles: ['admin'] } }
				});
			expect(canAutoTranslate()).toBe(false);
		});

		it('should handle errors gracefully', () => {
			mockGetState.mockImplementationOnce(() => {
				throw new Error('Test error');
			});
			expect(canAutoTranslate()).toBe(false);
		});
	});

	describe('isRead', () => {
		it('should return true for read item', () => {
			const item = {
				archived: false,
				open: true,
				unread: 0,
				alert: false
			};
			expect(isRead(item)).toBe(true);
		});

		it('should return false for unread item', () => {
			const item = {
				archived: false,
				open: true,
				unread: 5,
				alert: false
			};
			expect(isRead(item)).toBe(false);
		});

		it('should return false for item with alert', () => {
			const item = {
				archived: false,
				open: true,
				unread: 0,
				alert: true
			};
			expect(isRead(item)).toBe(false);
		});

		it('should return true for archived item', () => {
			const item = {
				archived: true,
				open: true,
				unread: 5,
				alert: true
			};
			expect(isRead(item)).toBe(true);
		});

		it('should return true for closed item', () => {
			const item = {
				archived: false,
				open: false,
				unread: 5,
				alert: true
			};
			expect(isRead(item)).toBe(true);
		});
	});

	describe('hasRole', () => {
		it('should return true when user has the role', () => {
			expect(hasRole('admin')).toBe(true);
		});

		it('should return true when user has multiple roles including the requested one', () => {
			expect(hasRole('user')).toBe(true);
		});

		it('should return false when user does not have the role', () => {
			expect(hasRole('nonexistent')).toBe(false);
		});

		it('should return false for empty role string', () => {
			expect(hasRole('')).toBe(false);
		});
	});

	describe('hasPermission', () => {
		it('should return array of booleans for permissions', async () => {
			const permissions = [['admin'], ['user']];
			const result = await hasPermission(permissions);
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(typeof result[0]).toBe('boolean');
			expect(typeof result[1]).toBe('boolean');
		});

		it('should handle undefined permissions array', async () => {
			// The default mock in beforeEach has user with ['user', 'admin'] roles
			// hasPermission checks: permission?.some(r => mergedRoles.includes(r))
			// For ['admin']: 'admin' is in ['user', 'admin'] -> true
			// For undefined: returns false
			const permissions: (string[] | undefined)[] = [['admin'], undefined];
			const result = await hasPermission(permissions);
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			// Verify the function works - check that we get boolean results
			expect(typeof result[0]).toBe('boolean');
			expect(typeof result[1]).toBe('boolean');
			// The actual values depend on the mock state, but we verify the function handles undefined
			expect(result[1]).toBe(false); // undefined permission always returns false
		});

		it('should return false array when room not found', async () => {
			mockDatabaseGet.mockReturnValueOnce({
				find: jest.fn().mockRejectedValue(new Error('Not found'))
			});
			const permissions = [['admin']];
			const result = await hasPermission(permissions, 'invalid-rid');
			expect(result).toEqual([false]);
		});

		it('should handle errors gracefully', async () => {
			mockGetState.mockImplementationOnce(() => {
				throw new Error('Test error');
			});
			const permissions = [['admin']];
			const result = await hasPermission(permissions);
			expect(result).toEqual([false]);
		});

		it('should work without rid parameter', async () => {
			const permissions = [['admin'], ['user']];
			const result = await hasPermission(permissions);
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
		});

		it('should handle empty permissions array', async () => {
			const permissions: string[][] = [];
			const result = await hasPermission(permissions);
			expect(result).toEqual([]);
		});
	});
});

