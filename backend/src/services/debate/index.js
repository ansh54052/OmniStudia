"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.addDebateMessage = addDebateMessage;exports.analyzeDebate = analyzeDebate;exports.createDebateSession = createDebateSession;exports.deleteDebateSession = deleteDebateSession;exports.getDebateSession = getDebateSession;exports.listDebateSessions = listDebateSessions;exports.streamDebateAnalysis = streamDebateAnalysis;exports.streamDebateResponse = streamDebateResponse;exports.surrenderDebate = surrenderDebate;exports.toText = toText;var _llm = _interopRequireDefault(require("../../utils/llm/llm"));
var _Debate = require("../../models/Debate");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}




























function toText(out) {
  if (!out) return "";
  if (typeof out === "string") return out;
  if (typeof out?.content === "string") return out.content;
  if (Array.isArray(out?.content))
  return out.content.
  map((p) => typeof p === "string" ? p : p?.text ?? "").
  join("");
  if (Array.isArray(out?.generations) && out.generations[0]?.text)
  return out.generations[0].text;
  return String(out ?? "");
}

async function createDebateSession(topic, position) {
  const id = `debate_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const session = new _Debate.DebateSession({
    id,
    topic,
    position,
    messages: [],
    createdAt: Date.now()
  });

  await session.save();
  return session.toObject();
}

async function getDebateSession(id) {
  const session = await _Debate.DebateSession.findOne({ id }).lean().exec();
  return session;
}

async function addDebateMessage(
sessionId,
role,
content)
{
  await _Debate.DebateSession.updateOne(
    { id: sessionId },
    { $push: { messages: { role, content, timestamp: Date.now() } } }
  ).exec();
}

async function* streamDebateResponse(
sessionId,
userArgument)
{
  const session = await getDebateSession(sessionId);
  if (!session) {
    throw new Error("Debate session not found");
  }

  await addDebateMessage(sessionId, "user", userArgument);

  const opposingPosition = session.position === "for" ? "against" : "for";

  // Check if AI should concede (after 3+ exchanges, detect weak position)
  const shouldCheckConcede = session.messages.length >= 6; // 3+ exchanges

  const systemPrompt = `You are an expert debater participating in a formal debate about: "${session.topic}"

Your position: You are arguing ${opposingPosition.toUpperCase()} the topic.
User's position: They are arguing ${session.position.toUpperCase()} the topic.

${shouldCheckConcede ? `IMPORTANT: If you find that you have run out of strong arguments, or if the user has made overwhelmingly convincing points that you cannot reasonably counter, you MUST start your response with exactly "[CONCEDE]" followed by a brief explanation of why you are conceding. This shows intellectual honesty and good sportsmanship.

` : ""}Guidelines for your responses:
1. Present strong, logical arguments ${opposingPosition} the topic
2. Use evidence, examples, and reasoning to support your points
3. Address and counter the user's arguments directly
4. Be respectful but assertive in your debate style
5. Keep responses focused, concise, well-structured and short (1-2 paragraphs)
6. Use rhetorical techniques like ethos, pathos, and logos
7. Structure your arguments clearly with transitions
8. Challenge weak points in the user's reasoning
9. Anticipate counterarguments and preemptively address them
10. Be savage, competitive, persuiasive, assertive and to the point
11. Exceed the paragraphs limit if needed to make a strong argument
${shouldCheckConcede ? "12. If you genuinely cannot provide a strong counterargument, CONCEDE rather than making weak arguments\n" : ""}
Remember: You are in a debate, so be persuasive and competitive while remaining intellectually honest.`;

  const conversationHistory = session.messages.
  slice(-6).
  map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).
  join("\n\n");

  const messages = [
  { role: "system", content: systemPrompt },
  { role: "user", content: `Previous exchanges:\n${conversationHistory}\n\nUser's latest argument:\n${userArgument}\n\nYour counter-argument (respond with a strong rebuttal${shouldCheckConcede ? ", or start with [CONCEDE] if you have no strong arguments left" : ""}):` }];


  const response = await _llm.default.call(messages);
  const fullResponse = toText(response).trim();

  if (fullResponse.startsWith("[CONCEDE]")) {
    const concedeReason = fullResponse.replace("[CONCEDE]", "").trim();
    await _Debate.DebateSession.updateOne({ id: sessionId }, { $set: { status: "ai_conceded", winner: "user" } }).exec();

    yield { type: "concede", reason: concedeReason };
    return;
  }

  const words = fullResponse.split(/(\s+)/);
  for (const word of words) {
    yield word;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  await addDebateMessage(sessionId, "assistant", fullResponse);
}

async function listDebateSessions() {
  return await _Debate.DebateSession.find().sort({ createdAt: -1 }).lean().exec();
}

async function deleteDebateSession(id) {
  await _Debate.DebateSession.deleteOne({ id }).exec();
  return true;
}

async function surrenderDebate(sessionId) {
  await _Debate.DebateSession.updateOne({ id: sessionId }, { $set: { status: "user_surrendered", winner: "ai" } }).exec();
}

async function* streamDebateAnalysis(sessionId)



{
  const session = await getDebateSession(sessionId);
  if (!session) {
    throw new Error("Debate session not found");
  }

  yield { type: "phase", value: "Gathering debate data..." };

  const userMessages = session.messages.filter((m) => m.role === "user").map((m) => m.content);
  const aiMessages = session.messages.filter((m) => m.role === "assistant").map((m) => m.content);

  yield { type: "phase", value: "Analyzing arguments..." };

  const analysisPrompt = `You are an expert debate judge analyzing a completed debate on the topic: "${session.topic}"

User's position: ${session.position.toUpperCase()}
AI's position: ${session.position === "for" ? "AGAINST" : "FOR"}

${session.status === "user_surrendered" ? "NOTE: The user surrendered this debate.\n" : ""}${session.status === "ai_conceded" ? "NOTE: The AI conceded this debate due to lack of strong counterarguments.\n" : ""}
User's arguments:
${userMessages.map((msg, i) => `${i + 1}. ${msg}`).join("\n\n")}

AI's arguments:
${aiMessages.map((msg, i) => `${i + 1}. ${msg}`).join("\n\n")}

Provide a comprehensive analysis in this EXACT JSON format (no markdown, just JSON):
{
  "winner": "user",
  "reason": "Brief explanation of why this party won",
  "userStrengths": ["strength 1", "strength 2", "strength 3"],
  "aiStrengths": ["strength 1", "strength 2", "strength 3"],
  "userWeaknesses": ["weakness 1", "weakness 2"],
  "aiWeaknesses": ["weakness 1", "weakness 2"],
  "keyMoments": ["moment 1", "moment 2", "moment 3"],
  "overallAssessment": "A paragraph summarizing the debate quality and outcome"
}`;

  const messages = [
  { role: "system", content: "You are an expert debate judge. Provide fair, balanced analysis. Respond with valid JSON only." },
  { role: "user", content: analysisPrompt }];


  try {
    yield { type: "phase", value: "Consulting AI judge..." };

    const response = await _llm.default.call(messages);
    const analysisText = toText(response).trim();

    yield { type: "phase", value: "Processing results..." };

    let jsonText = analysisText;
    const jsonMatch = analysisText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const analysis = JSON.parse(jsonText);

    if (!session.winner) {
      await _Debate.DebateSession.updateOne({ id: sessionId }, { $set: { winner: analysis.winner, status: "completed" } }).exec();
    }

    yield { type: "analysis", data: analysis };
  } catch (error) {
    console.error("[Debate Analysis] Error:", error);

    yield { type: "phase", value: "Generating fallback analysis..." };

    const fallbackAnalysis = {
      winner: session.winner || "draw",
      reason: session.winner === "user" ? "User presented stronger arguments" : session.winner === "ai" ? "AI presented stronger arguments" : "Both sides presented balanced arguments",
      userStrengths: ["Engaged in debate", "Presented arguments", "Maintained position"],
      aiStrengths: ["Provided counterarguments", "Challenged user's points", "Used logical reasoning"],
      userWeaknesses: [],
      aiWeaknesses: [],
      keyMoments: ["Opening arguments", "Key rebuttals", "Final exchanges"],
      overallAssessment: `The debate featured ${userMessages.length} exchanges with arguments from both sides. Due to technical limitations, a detailed analysis could not be completed, but both participants engaged meaningfully in the discussion.`
    };

    yield { type: "analysis", data: fallbackAnalysis };
  }
}

async function analyzeDebate(sessionId) {
  const session = await getDebateSession(sessionId);
  if (!session) {
    throw new Error("Debate session not found");
  }

  const userMessages = session.messages.filter((m) => m.role === "user").map((m) => m.content);
  const aiMessages = session.messages.filter((m) => m.role === "assistant").map((m) => m.content);

  console.log("[Debate Analysis] Starting analysis for session:", sessionId);

  const analysisPrompt = `You are an expert debate judge analyzing a completed debate on the topic: "${session.topic}"

User's position: ${session.position.toUpperCase()}
AI's position: ${session.position === "for" ? "AGAINST" : "FOR"}

${session.status === "user_surrendered" ? "NOTE: The user surrendered this debate.\n" : ""}${session.status === "ai_conceded" ? "NOTE: The AI conceded this debate due to lack of strong counterarguments.\n" : ""}
User's arguments:
${userMessages.map((msg, i) => `${i + 1}. ${msg}`).join("\n\n")}

AI's arguments:
${aiMessages.map((msg, i) => `${i + 1}. ${msg}`).join("\n\n")}

Provide a comprehensive analysis in this EXACT JSON format (no markdown, just JSON):
{
  "winner": "user",
  "reason": "Brief explanation of why this party won",
  "userStrengths": ["strength 1", "strength 2", "strength 3"],
  "aiStrengths": ["strength 1", "strength 2", "strength 3"],
  "userWeaknesses": ["weakness 1", "weakness 2"],
  "aiWeaknesses": ["weakness 1", "weakness 2"],
  "keyMoments": ["moment 1", "moment 2", "moment 3"],
  "overallAssessment": "A paragraph summarizing the debate quality and outcome"
}`;

  const messages = [
  { role: "system", content: "You are an expert debate judge. Provide fair, balanced analysis. Respond with valid JSON only." },
  { role: "user", content: analysisPrompt }];


  try {
    console.log("[Debate Analysis] Calling LLM...");
    const response = await _llm.default.call(messages);
    const analysisText = toText(response).trim();
    console.log("[Debate Analysis] LLM response received, length:", analysisText.length);

    let jsonText = analysisText;
    const jsonMatch = analysisText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const analysis = JSON.parse(jsonText);
    console.log("[Debate Analysis] Successfully parsed analysis");

    if (!session.winner) {
      await _Debate.DebateSession.updateOne({ id: sessionId }, { $set: { winner: analysis.winner, status: "completed" } }).exec();
    }

    return analysis;
  } catch (error) {
    console.error("[Debate Analysis] Error:", error);
    return {
      winner: session.winner || "draw",
      reason: session.winner === "user" ? "User presented stronger arguments" : session.winner === "ai" ? "AI presented stronger arguments" : "Both sides presented balanced arguments",
      userStrengths: ["Engaged in debate", "Presented arguments", "Maintained position"],
      aiStrengths: ["Provided counterarguments", "Challenged user's points", "Used logical reasoning"],
      userWeaknesses: [],
      aiWeaknesses: [],
      keyMoments: ["Opening arguments", "Key rebuttals", "Final exchanges"],
      overallAssessment: "The debate featured " + userMessages.length + " exchanges with arguments from both sides. Due to technical limitations, a detailed analysis could not be completed, but both participants engaged meaningfully in the discussion."
    };
  }
}