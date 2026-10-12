import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

export async function createConversation(req, res) {
  try {
    const title = req.body?.title || 'New conversation';

    const conversation = await Conversation.create({
      userId: req.user._id,
      tenantId: req.tenantId,
      title: title.trim().slice(0, 100),
    });

    res.status(201).json({
      success: true,
      conversation,
    });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function listConversations(req, res) {
  try {
    const conversations = await Conversation.find({
      tenantId: req.tenantId,
      isArchived: false,
    })
      .sort({ lastMessageAt: -1 })
      .limit(50);

    res.json({
      success: true,
      conversations,
    });
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getConversation(req, res) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      conversation,
      messages,
    });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function renameConversation(req, res) {
  try {
    const title = req.body?.title;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { title: title.trim().slice(0, 100) },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    res.json({
      success: true,
      conversation,
    });
  } catch (err) {
    console.error('Rename conversation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteConversation(req, res) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    await Message.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}