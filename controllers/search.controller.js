import Document from '../models/Document.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

/**
 * GET /api/search?q=query
 * Returns matched documents, conversations, and team members.
 * Fuzzy, case-insensitive, limited to 5 per category.
 */
export async function globalSearch(req, res) {
  try {
    const tenantId = req.tenantId;
    const q = (req.query.q || '').toString().trim();

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        query: q,
        results: {
          documents: [],
          conversations: [],
          members: [],
        },
      });
    }

    // Escape regex special chars
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');

    const [documents, conversations, members] = await Promise.all([
      Document.find({
        tenantId,
        $or: [{ fileName: regex }],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fileName pageCount status createdAt'),

      Conversation.find({
        tenantId,
        title: regex,
      })
        .sort({ lastMessageAt: -1 })
        .limit(5)
        .select('title messageCount lastMessageAt createdAt'),

      User.find({
        tenantId,
        $or: [{ name: regex }, { email: regex }],
      })
        .limit(5)
        .select('name email role'),
    ]);

    return res.json({
      success: true,
      query: q,
      results: {
        documents: documents.map((d) => ({
          id: d._id,
          title: d.fileName,
          subtitle: `${d.pageCount} pages · ${d.status}`,
          href: '/documents',
        })),
        conversations: conversations.map((c) => ({
          id: c._id,
          title: c.title,
          subtitle: `${c.messageCount} messages`,
          href: `/chat?c=${c._id}`,
        })),
        members: members.map((m) => ({
          id: m._id,
          title: m.name,
          subtitle: `${m.email} · ${m.role}`,
          href: '/team',
        })),
      },
    });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
