const prisma = require('../config/prisma');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { publishConsultationEvent } = require('../services/consultation-events.service');

const AI_BOT_NAME = 'Gemma AI';
const AI_BOT_EMAIL = 'gemma.ai@myskin.local';
const GEMMA_API_URL = process.env.GEMMA_API_URL?.trim() || '';
const GEMMA_API_TIMEOUT_MS = Number(process.env.GEMMA_API_TIMEOUT_MS || 60000);

const mapChatMessage = (chatMessage) => ({
  id: chatMessage.id,
  message: chatMessage.message,
  sender: chatMessage.sender
    ? {
      id: chatMessage.sender.id,
      name: chatMessage.sender.name,
      role: chatMessage.sender.role,
      avatarUrl: chatMessage.sender.avatarUrl
    }
    : null,
  senderId: chatMessage.senderId,
  senderRole: chatMessage.sender?.role || null,
  timestamp: chatMessage.timestamp,
  createdAt: chatMessage.timestamp,
  consultationId: chatMessage.consultationId
});

const validatePatientConsultation = (consultation, userId) => {
  if (!consultation) {
    throw new Error('Consultation not found');
  }

  if (consultation.patientId !== userId) {
    throw new Error('Unauthorized: You are not allowed to access this AI consultation');
  }
};

const validateAiConsultation = (consultation) => {
  const configuredAiBotUserId = process.env.AI_BOT_USER_ID?.trim();
  if (configuredAiBotUserId && consultation.doctorId !== configuredAiBotUserId) {
    throw new Error('Unauthorized: This consultation is not assigned to Gemma AI');
  }
};

const getOrCreateInternalAiBotUser = async () => {
  const existingBot = await prisma.user.findUnique({
    where: { email: AI_BOT_EMAIL },
    select: { id: true }
  });

  if (existingBot) {
    return existingBot;
  }

  try {
    return await prisma.user.create({
      data: {
        name: AI_BOT_NAME,
        email: AI_BOT_EMAIL,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        role: 'doctor',
        status: 'active',
      },
      select: { id: true }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return prisma.user.findUnique({
        where: { email: AI_BOT_EMAIL },
        select: { id: true }
      });
    }

    throw error;
  }
};

const getAiBotUserId = async () => {
  const configuredAiBotUserId = process.env.AI_BOT_USER_ID?.trim();
  if (configuredAiBotUserId) {
    return configuredAiBotUserId;
  }

  const aiBotUser = await getOrCreateInternalAiBotUser();
  return aiBotUser.id;
};

const formatConfidence = (confidence) => {
  if (typeof confidence !== 'number') {
    return 'Tidak tersedia';
  }

  return confidence <= 1
    ? `${Math.round(confidence * 100)}%`
    : `${Math.round(confidence)}%`;
};

const buildSystemPrompt = (scan = {}) => {
  const complaint = scan.complaint || 'Tidak ada keluhan yang dicatat';
  const result = scan.aiPrediction || 'Belum tersedia';
  const confidence = formatConfidence(scan.aiConfidence);
  const bodySite = scan.bodySite || 'Tidak disebutkan';
  const aiDetails = scan.aiDetails || 'Tidak ada detail tambahan';

  return [
    'Anda adalah Gemma AI, asisten konsultasi awal untuk aplikasi MySkin.',
    'Bantu pasien memahami hasil scan kulit mereka dengan bahasa Indonesia yang tenang, jelas, dan mudah dipahami.',
    '',
    'Konteks hasil scan pasien:',
    `- Keluhan: ${complaint}`,
    `- Lokasi lesi: ${bodySite}`,
    `- Hasil analisis AI: ${result}`,
    `- Confidence: ${confidence}`,
    `- Detail tambahan: ${aiDetails}`,
    '',
    'Aturan jawaban:',
    '- Jangan menyatakan diagnosis final atau menggantikan dokter.',
    '- Jelaskan bahwa hasil AI adalah bantuan skrining awal dan tetap perlu konfirmasi tenaga medis.',
    '- Berikan edukasi umum, langkah aman berikutnya, dan tanda bahaya yang perlu segera diperiksakan.',
    '- Jika pasien menanyakan obat, tindakan invasif, atau keputusan klinis pasti, arahkan untuk konsultasi dokter.',
    '- Jawab ringkas, empatik, dan relevan dengan konteks scan di atas.'
  ].join('\n');
};

const buildGemmaPrompt = (systemPrompt, chatHistory) => {
  const formattedHistory = chatHistory
    .map((chatMessage) => {
      const role = chatMessage.role === 'assistant' ? 'Assistant' : 'Patient';
      return `${role}: ${chatMessage.content}`;
    })
    .join('\n');

  return [
    systemPrompt,
    '',
    'Riwayat percakapan:',
    formattedHistory,
    '',
    'Assistant:'
  ].join('\n');
};

const extractGemmaReply = (data) => {
  if (typeof data === 'string') {
    return data.trim();
  }

  if (!data || typeof data !== 'object') {
    return '';
  }

  const candidates = [
    data.response,
    data.generated_text,
    data.text,
    data.output,
    data.message?.content,
    data.data?.response,
    data.data?.generated_text,
    data.data?.text,
    data.data?.output,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const reply = extractGemmaReply(item);
      if (reply) {
        return reply;
      }
    }
  }

  if (Array.isArray(data.data)) {
    for (const item of data.data) {
      const reply = extractGemmaReply(item);
      if (reply) {
        return reply;
      }
    }
  }

  return '';
};

const requestGemmaReply = async ({ systemPrompt, chatHistory }) => {
  if (!GEMMA_API_URL) {
    throw new Error('AI chatbot service is unavailable: GEMMA_API_URL is not configured');
  }

  const prompt = buildGemmaPrompt(systemPrompt, chatHistory);

  try {
    const response = await axios.post(
      GEMMA_API_URL,
      {
        prompt,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
        ],
        stream: false,
      },
      {
        timeout: GEMMA_API_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    if (response.status < 200 || response.status >= 300) {
      const detail = typeof response.data === 'string'
        ? response.data
        : response.data?.message || response.data?.error || JSON.stringify(response.data);
      throw new Error(`Gemma API returned HTTP ${response.status}: ${detail}`);
    }

    return extractGemmaReply(response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('AI chatbot service is unavailable: Gemma API request timed out');
    }

    throw new Error(`AI chatbot service is unavailable: ${error.message}`);
  }
};

const getAiChatHistory = async (userId, consultationId) => {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId }
  });

  validatePatientConsultation(consultation, userId);
  validateAiConsultation(consultation);

  const messages = await prisma.chatMessage.findMany({
    where: { consultationId },
    orderBy: { timestamp: 'asc' },
    include: {
      sender: { select: { id: true, name: true, role: true, avatarUrl: true } }
    }
  });

  return messages.map(mapChatMessage);
};

const sendAiMessage = async (userId, consultationId, messageContent) => {
  const message = (messageContent || '').trim();

  if (!message) {
    throw new Error('Message is required');
  }

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      scan: true
    }
  });

  validatePatientConsultation(consultation, userId);
  validateAiConsultation(consultation);

  if (consultation.status !== 'OPEN') {
    throw new Error('Cannot send messages in a closed consultation');
  }

  const aiBotUserId = await getAiBotUserId();

  const userMessage = await prisma.chatMessage.create({
    data: {
      consultationId,
      senderId: userId,
      message,
      timestamp: new Date(),
      readReceipts: {
        create: {
          userId
        }
      }
    },
    include: {
      sender: { select: { id: true, name: true, role: true, avatarUrl: true } }
    }
  });

  const mappedUserMessage = mapChatMessage(userMessage);
  publishConsultationEvent(consultationId, 'NEW_MESSAGE', mappedUserMessage);
  publishConsultationEvent(consultationId, 'TYPING', { isTyping: true, sender: AI_BOT_NAME });

  let typingStopped = false;

  try {
    const recentMessages = await prisma.chatMessage.findMany({
      where: { consultationId },
      take: 15,
      orderBy: { timestamp: 'desc' }
    });

    const chatHistory = recentMessages.reverse().map((chatMessage) => ({
      role: chatMessage.senderId === aiBotUserId ? 'assistant' : 'user',
      content: chatMessage.message
    }));

    const aiReplyContent = await requestGemmaReply({
      systemPrompt: buildSystemPrompt(consultation.scan),
      chatHistory,
    });

    if (!aiReplyContent) {
      throw new Error('Gemma AI did not return a response');
    }

    const aiMessage = await prisma.chatMessage.create({
      data: {
        consultationId,
        senderId: aiBotUserId,
        message: aiReplyContent,
        timestamp: new Date()
      },
      include: {
        sender: { select: { id: true, name: true, role: true, avatarUrl: true } }
      }
    });

    await prisma.consultation.update({
      where: { id: consultationId },
      data: { updatedAt: new Date() }
    });

    const mappedAiMessage = mapChatMessage(aiMessage);
    publishConsultationEvent(consultationId, 'TYPING', { isTyping: false, sender: AI_BOT_NAME });
    typingStopped = true;
    publishConsultationEvent(consultationId, 'NEW_MESSAGE', mappedAiMessage);

    return mappedAiMessage;
  } finally {
    if (!typingStopped) {
      publishConsultationEvent(consultationId, 'TYPING', { isTyping: false, sender: AI_BOT_NAME });
    }
  }
};

module.exports = {
  getAiChatHistory,
  sendAiMessage
};
