import Notification from '../models/Notification.js';

const subscribers = new Map();

export function subscribe(userId, res) {
  const key = userId.toString();
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(res);
}

export function unsubscribe(userId, res) {
  const key = userId.toString();
  const set = subscribers.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribers.delete(key);
}

function pushToUser(userId, event) {
  const key = userId.toString();
  const set = subscribers.get(key);
  if (!set) return;
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(
    event.data
  )}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}

export async function notify({
  userId,
  tenantId,
  type,
  title,
  description = '',
  href = null,
  meta = {},
}) {
  if (!userId || !tenantId) return null;

  const notification = await Notification.create({
    userId,
    tenantId,
    type,
    title,
    description,
    href,
    meta,
  });

  pushToUser(userId, {
    type: 'notification',
    data: {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      description: notification.description,
      href: notification.href,
      meta: notification.meta,
      read: false,
      createdAt: notification.createdAt,
    },
  });

  return notification;
}

export async function notifyTenantOwner({
  tenant,
  type,
  title,
  description,
  href,
  meta,
}) {
  if (!tenant?.ownerId) return null;
  return notify({
    userId: tenant.ownerId,
    tenantId: tenant._id,
    type,
    title,
    description,
    href,
    meta,
  });
}

export function emitRead(userId, notificationId) {
  pushToUser(userId, {
    type: 'read',
    data: { id: notificationId },
  });
}

export function emitReadAll(userId) {
  pushToUser(userId, {
    type: 'readAll',
    data: {},
  });
}
