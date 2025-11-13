import log from './log';
import { store as reduxStore } from '../../store/auxStore';
import database from '../../database';
import {
	type ISubscription,
	type TSubscriptionModel,
	type IUser,
	type IOmnichannelRoom,
	type ISearchLocal,
	type RoomType,
	SubscriptionType
} from '../../../definitions';

// Flexible room type that accepts various room-like objects
type TRoom =
	| (Partial<ISubscription> | TSubscriptionModel)
	| IOmnichannelRoom
	| ISearchLocal
	| IUser
	| {
			rid?: string;
			t?: SubscriptionType | RoomType | string;
			name?: string;
			fname?: string;
			prid?: string;
			uids?: string[];
			usernames?: string[];
			_id?: string;
			_updatedAt?: string | Date;
			[key: string]: any;
	  }
	| { itsMe?: boolean };
type TSender = Pick<IUser, 'name' | 'username'> | { name?: string; username: string };
type TReadItem = Pick<ISubscription, 'archived' | 'open' | 'unread' | 'alert'>;

export function isGroupChat(room: TRoom | undefined): boolean {
	if (!room) {
		return false;
	}
	const uids = 'uids' in room ? room.uids : undefined;
	const usernames = 'usernames' in room ? room.usernames : undefined;
	return ((uids && uids.length > 2) || (usernames && usernames.length > 2)) ?? false;
}

export function getRoomAvatar(room: TRoom | undefined): string {
	if (!room) {
		return '';
	}
	if (isGroupChat(room) && 'uids' in room && room.uids && 'usernames' in room && room.usernames) {
		return room.uids.length + room.usernames.join();
	}
	const prid = 'prid' in room ? room.prid : undefined;
	const fname = 'fname' in room ? room.fname : undefined;
	const name = 'name' in room ? room.name : undefined;
	return prid ? fname || '' : name || '';
}

export function getUidDirectMessage(room: TRoom | null | undefined): string | undefined {
	const { id: userId } = reduxStore.getState().login.user;

	if (!room) {
		return undefined;
	}

	if ('itsMe' in room && room.itsMe) {
		return userId || undefined;
	}

	// legacy method
	if (!('uids' in room) || !room.uids) {
		if ('rid' in room && room.rid && ('t' in room && (room.t === SubscriptionType.DIRECT || room.t === 'd')) && userId) {
			return room.rid.replace(userId, '').trim();
		}
	}

	if (isGroupChat(room)) {
		return undefined;
	}

	const uids = 'uids' in room ? room.uids : undefined;
	const me = uids?.find(uid => uid === userId);
	const other = uids?.filter(uid => uid !== userId);

	return other && other.length ? other[0] : me || undefined;
}

export function getRoomTitle(room: TRoom | undefined): string {
	if (!room) {
		return '';
	}
	const { UI_Use_Real_Name: useRealName, UI_Allow_room_names_with_special_chars: allowSpecialChars } =
		reduxStore.getState().settings;
	const { username } = reduxStore.getState().login.user;
	if ('federated' in room && room.federated === true) {
		return ('fname' in room ? room.fname : '') || '';
	}
	if (isGroupChat(room) && !('name' in room && room.name && room.name.length) && 'usernames' in room && room.usernames) {
		return room.usernames
			.filter(u => u !== username)
			.sort((u1, u2) => u1.localeCompare(u2))
			.join(', ');
	}
	const roomType = 't' in room ? room.t : undefined;
	if (allowSpecialChars && roomType && roomType !== SubscriptionType.DIRECT && roomType !== 'd') {
		return ('fname' in room ? room.fname : '') || ('name' in room ? room.name : '') || '';
	}
	const prid = 'prid' in room ? room.prid : undefined;
	const fname = 'fname' in room ? room.fname : undefined;
	const name = 'name' in room ? room.name : undefined;
	return ((prid || useRealName) && fname) || name || '';
}

export function getSenderName(sender: TSender): string {
	const { UI_Use_Real_Name: useRealName } = reduxStore.getState().settings;
	return useRealName ? sender.name || '' : sender.username || '';
}

export function canAutoTranslate(): boolean {
	try {
		const { AutoTranslate_Enabled } = reduxStore.getState().settings;
		if (!AutoTranslate_Enabled) {
			return false;
		}
		const autoTranslatePermission = reduxStore.getState().permissions['auto-translate'];
		const userRoles = reduxStore.getState().login?.user?.roles ?? [];
		return autoTranslatePermission?.some(role => userRoles.includes(role)) ?? false;
	} catch (e) {
		log(e);
		return false;
	}
}

export function isRead(item: TReadItem): boolean {
	let isUnread = item.archived !== true && item.open === true; // item is not archived and not opened
	isUnread = isUnread && (item.unread > 0 || item.alert === true); // either its unread count > 0 or its alert
	return !isUnread;
}

export function hasRole(role: string): boolean {
	const loginUser = reduxStore.getState().login.user;
	const userRoles = loginUser?.roles || [];
	return userRoles.indexOf(role) > -1;
}

export async function hasPermission(
	permissions: (string[] | undefined)[] | string[][],
	rid?: string
): Promise<boolean[]> {
	let roomRoles: string[] = [];
	if (rid) {
		const db = database.active;
		const subsCollection = db.get('subscriptions');
		try {
			// get the room from database
			const room = await subsCollection.find(rid);
			// get room roles
			roomRoles = room.roles || [];
		} catch (error) {
			console.log('hasPermission -> Room not found');
			return permissions.map(() => false);
		}
	}

	try {
		const loginUser = reduxStore.getState().login.user;
		const userRoles = loginUser?.roles || [];
		const mergedRoles = [...new Set([...roomRoles, ...userRoles])];
		return permissions.map(permission => (permission?.some(r => mergedRoles.includes(r)) ?? false));
	} catch (e) {
		log(e);
		return permissions.map(() => false);
	}
}
