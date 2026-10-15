import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import ShareLink from '../models/ShareLink.js';
import Usage from '../models/Usage.js';

/**
 * GET /api/backup/export
 * Super admin: full platform backup JSON.
 */
export async function exportAll(req, res) {
  try {
    const [tenants, users, documents, chunks, conversations, messages, shares, usage] =
      await Promise.all([
        Tenant.find().lean(),
        User.find().select('-password').lean(),
        Document.find().lean(),
        Chunk.find().lean(),
        Conversation.find().lean(),
        Message.find().lean(),
        ShareLink.find().lean(),
        Usage.find().lean(),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      counts: {
        tenants: tenants.length,
        users: users.length,
        documents: documents.length,
        chunks: chunks.length,
        conversations: conversations.length,
        messages: messages.length,
        shares: shares.length,
        usage: usage.length,
      },
      data: {
        tenants,
        users,
        documents,
        chunks,
        conversations,
        messages,
        shares,
        usage,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="localbiz-backup-${Date.now()}.json"`
    );
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/backup/health
 * Public endpoint — health check for monitoring.
 */
export async function healthCheck(req, res) {
  try {
    const checks = {
      api: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      mongodb: 'unknown',
    };

    // Test DB ping
    try {
      const mongoose = await import('mongoose');
      await mongoose.default.connection.db.admin().ping();
      checks.mongodb = 'ok';
    } catch {
      checks.mongodb = 'error';
    }

    const healthy = checks.mongodb === 'ok';
    return res.status(healthy ? 200 : 503).json({
      success: healthy,
      ...checks,
    });
  } catch (err) {
    return res.status(503).json({
      success: false,
      error: err.message,
    });
  }
}

/**
 * GET /api/backup/stats
 * Super admin: quick stats about the DB size.
 */
export async function backupStats(req, res) {
  try {
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    const stats = await db.stats();

    return res.json({
      success: true,
      database: {
        name: db.databaseName,
        collections: stats.collections,
        objects: stats.objects,
        dataSizeMB: Math.round(stats.dataSize / 1024 / 1024),
        storageSizeMB: Math.round(stats.storageSize / 1024 / 1024),
        indexes: stats.indexes,
        indexSizeMB: Math.round(stats.indexSize / 1024 / 1024),
      },
    });
  } catch (err) {
    console.error('Backup stats error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
