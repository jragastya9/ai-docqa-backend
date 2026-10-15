import ModerationLog from '../models/ModerationLog.js';
import AbuseReport from '../models/AbuseReport.js';
import User from '../models/User.js';

/**
 * POST /api/moderation/report
 * Any authenticated user can report abuse.
 */
export async function reportAbuse(req, res) {
  try {
    const { category, description, reportedTenantId, reportedUserId } =
      req.body;

    if (!category || !description) {
      return res.status(400).json({
        success: false,
        error: 'Category and description are required',
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Description too long (max 2000 chars)',
      });
    }

    const report = await AbuseReport.create({
      reporterUserId: req.user._id,
      reporterEmail: req.user.email,
      reportedTenantId: reportedTenantId || null,
      reportedUserId: reportedUserId || null,
      category,
      description: description.trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Report submitted. Our team will review it.',
      reportId: report._id,
    });
  } catch (err) {
    console.error('Report abuse error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/moderation/logs
 * Super admin only.
 */
export async function listModerationLogs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { flagged } = req.query;

    const filter = {};
    if (flagged === 'true') filter.flagged = true;

    const logs = await ModerationLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      logs: logs.map((l) => ({
        id: l._id,
        content: l.contentPreview,
        source: l.source,
        flagged: l.flagged,
        categories: l.categories,
        action: l.action,
        reason: l.reason,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error('List moderation logs error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/moderation/reports
 * Super admin only.
 */
export async function listAbuseReports(req, res) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const reports = await AbuseReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      reports: reports.map((r) => ({
        id: r._id,
        reporterEmail: r.reporterEmail,
        reportedTenantId: r.reportedTenantId,
        category: r.category,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('List abuse reports error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * PATCH /api/moderation/reports/:id
 * Super admin only.
 */
export async function updateAbuseReport(req, res) {
  try {
    const { status, resolutionNote } = req.body;
    if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid status' });
    }

    const report = await AbuseReport.findByIdAndUpdate(
      req.params.id,
      {
        status,
        resolutionNote: resolutionNote || null,
        resolvedBy: req.user._id,
        resolvedAt: status === 'resolved' ? new Date() : null,
      },
      { new: true }
    );

    if (!report) {
      return res
        .status(404)
        .json({ success: false, error: 'Report not found' });
    }

    return res.json({ success: true, report: { status: report.status } });
  } catch (err) {
    console.error('Update abuse report error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
