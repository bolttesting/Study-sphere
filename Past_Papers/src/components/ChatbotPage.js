// src/components/ChatbotPage.js  ── FULL REPLACEMENT
import React, { useState, useEffect, useRef } from 'react';
import './chatbot.css';
import MessageBubble from './MessageBubble';
import AnimatedBot from './AnimatedBot';
import { chatbot as chatbotApi, notes as notesApi, chatSessions as sessionsApi, queries as queriesApi } from '../services/api';
import { authStorage } from '../services/auth';

const TABS = { GENERAL: 'GENERAL', RAG: 'RAG' };

const ChatbotPage = () => {
  const currentUser = authStorage.getUser() || {};

  // ── Active session ──────────────────────────────────────────────────────────
  const [sessionId, setSessionId]     = useState(null);
  const [sessions, setSessions]       = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState(TABS.GENERAL);
  const [messages, setMessages]       = useState([
    { id: 1, sender: 'bot', text: "Hi! I'm your study assistant. How can I help you today?" },
  ]);
  const [inputValue, setInputValue]   = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);

  // ── RAG ─────────────────────────────────────────────────────────────────────
  const [availableNotes, setAvailableNotes]   = useState([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [notesLoading, setNotesLoading]       = useState(false);
  const [needsEscalation, setNeedsEscalation] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(currentUser.email || '');

  const messagesEndRef = useRef(null);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  // ── Load sessions sidebar on mount ─────────────────────────────────────────
  useEffect(() => {
    loadSessions();
  }, []);

  // ── Load notes when RAG tab opens ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab === TABS.RAG && availableNotes.length === 0) {
      fetchNotes();
    }
  }, [activeTab, availableNotes.length]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await sessionsApi.list();
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchNotes = async () => {
    setNotesLoading(true);
    try {
      const data = await notesApi.list();
      setAvailableNotes(data);
    } catch (e) {
      console.error('Failed to load notes:', e);
    } finally {
      setNotesLoading(false);
    }
  };

  // ── Load a past session ─────────────────────────────────────────────────────
  const loadSession = async (session) => {
    try {
      const data = await sessionsApi.get(session.id);
      setSessionId(data.id);
      setActiveTab(data.mode || TABS.GENERAL);

      // Convert DB messages to UI format
      const uiMessages = data.messages.map((m) => ({
        id:     m.id,
        sender: m.role === 'assistant' ? 'bot' : 'user',
        text:   m.content,
      }));
      setMessages(uiMessages.length > 0 ? uiMessages : [
        { id: Date.now(), sender: 'bot', text: "Hi! I'm your study assistant. How can I help you today?" },
      ]);
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  };

  // ── Start a fresh chat ──────────────────────────────────────────────────────
  const startNewChat = () => {
    setSessionId(null);
    setMessages([
      { id: Date.now(), sender: 'bot', text: "Hi! I'm your study assistant. How can I help you today?" },
    ]);
    setInputValue('');
    setSelectedNoteIds([]);
  };

  // ── Delete a session ────────────────────────────────────────────────────────
  const deleteSession = async (e, targetSessionId) => {
    e.stopPropagation();
    try {
      await sessionsApi.delete(targetSessionId);
      setSessions((prev) => prev.filter((s) => s.id !== targetSessionId));
      if (sessionId === targetSessionId) startNewChat();
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const toggleNoteSelection = (id) => {
    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (activeTab === TABS.RAG && selectedNoteIds.length === 0) {
      addMessage({
        id: Date.now(), sender: 'bot',
        text: 'Please select at least one note from the panel before asking in RAG mode.',
      });
      return;
    }

    addMessage({ id: Date.now(), sender: 'user', text: trimmed });
    setInputValue('');
    setIsBotTyping(true);
    setNeedsEscalation(false);

    try {
      const payload = {
        message:           trimmed,
        mode:              activeTab,
        selected_note_ids: activeTab === TABS.RAG ? selectedNoteIds : [],
        session_id:        sessionId || null,
      };

      const data = await chatbotApi.send(payload);

      // Save returned session_id (needed for new sessions)
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        // Refresh sidebar to show new session
        loadSessions();
      } else if (data.session_id) {
        // Refresh to update title / last message in sidebar
        loadSessions();
      }

      addMessage({
        id:      Date.now() + 1,
        sender:  'bot',
        text:    data.reply || data.response || 'No response received.',
        sources: data.sources || [],
      });
      if (data.unanswered) {
        setNeedsEscalation(true);
        setPendingQuestion(trimmed);
      }
    } catch (e) {
      addMessage({
        id:     Date.now() + 1,
        sender: 'bot',
        text:   `Sorry, I encountered an error: ${e.message || 'Please try again.'}`,
      });
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleEscalateQuery = async () => {
    if (!pendingQuestion) return;
    try {
      await queriesApi.submit({ question: pendingQuestion, student_email: notifyEmail });
      addMessage({
        id: Date.now() + 2,
        sender: 'bot',
        text: 'Your query has been forwarded to admin. You will be notified by email once answered.',
      });
      setNeedsEscalation(false);
      setPendingQuestion('');
    } catch (e) {
      addMessage({
        id: Date.now() + 2,
        sender: 'bot',
        text: `Could not submit query right now: ${e.message}`,
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)  return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="chatbot-page">
      <div className="chatbot-container" style={{ display: 'flex', gap: 0 }}>

        {/* ── History Sidebar ──────────────────────────────────────────────── */}
        <aside className={`chat-history-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">Chat History</span>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(false)}>X</button>
          </div>

          <button className="new-chat-btn" onClick={startNewChat}>
            New Chat
          </button>

          <div className="session-list">
            {sessionsLoading && <p className="sidebar-hint">Loading…</p>}
            {!sessionsLoading && sessions.length === 0 && (
              <p className="sidebar-hint">No chat history yet.</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${s.id === sessionId ? 'active' : ''}`}
                onClick={() => loadSession(s)}
              >
                <div className="session-item-top">
                  <span className="session-mode-badge">{s.mode}</span>
                  <span className="session-date">{formatDate(s.updated_at)}</span>
                </div>
                <p className="session-title">{s.title}</p>
                <p className="session-preview">{s.last_message}</p>
                <button
                  className="session-delete-btn"
                  onClick={(e) => deleteSession(e, s.id)}
                  title="Delete chat"
                >Del</button>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main Chat Panel ──────────────────────────────────────────────── */}
        <div className="chat-panel" style={{ flex: 1 }}>
          <header className="chat-header">
            <div className="chat-header-left">
              {!sidebarOpen && (
                <button
                  className="sidebar-open-btn"
                  onClick={() => setSidebarOpen(true)}
                  title="Show history"
                >Menu</button>
              )}
              <AnimatedBot />
              <div>
                <h1 className="chat-title">Chatbot Assistant</h1>
                <p className="chat-subtitle">
                  {currentUser.firstName} · Class {currentUser.class_name}
                  {sessionId && <span className="session-indicator"> · Session active</span>}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="chat-tabs">
                <button
                  className={`chat-tab ${activeTab === TABS.GENERAL ? 'active' : ''}`}
                  onClick={() => setActiveTab(TABS.GENERAL)}
                >General Q&A</button>
                <button
                  className={`chat-tab ${activeTab === TABS.RAG ? 'active' : ''}`}
                  onClick={() => setActiveTab(TABS.RAG)}
                >RAG Mode</button>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                sender={msg.sender}
                text={msg.text}
                sources={msg.sources}
              />
            ))}
            {isBotTyping && <MessageBubble sender="bot" isTyping text="Typing…" />}
            <div ref={messagesEndRef} />
          </div>

          {/* RAG notes panel */}
          {activeTab === TABS.RAG && (
            <div className="rag-notes-panel">
              <p className="rag-notes-label">
                Select notes to reference
                {selectedNoteIds.length > 0 && (
                  <span className="notes-selected-count">{selectedNoteIds.length} selected</span>
                )}
              </p>
              {notesLoading ? (
                <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>Loading notes…</p>
              ) : (
                <div className="notes-list">
                  {availableNotes.map((note) => (
                    <label key={note.id} className="note-item">
                      <input
                        type="checkbox"
                        checked={selectedNoteIds.includes(note.id)}
                        onChange={() => toggleNoteSelection(note.id)}
                        className="note-item-check"
                      />
                      <div className="note-item-info">
                        <span className="note-item-title">{note.title}</span>
                        <span className="note-item-meta">{note.subject} · {note.class_name}</span>
                      </div>
                    </label>
                  ))}
                  {availableNotes.length === 0 && (
                    <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>No notes available.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-area">
            <textarea
              className="chat-input"
              placeholder={
                activeTab === TABS.GENERAL
                  ? 'Ask me anything…'
                  : 'Ask about your selected notes…'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={isBotTyping || !inputValue.trim()}
            >
              Send
            </button>
          </div>
          {needsEscalation && (
            <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid rgba(148,163,184,0.2)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="Email for admin response"
                style={{ flex: 1, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '0.45rem 0.6rem' }}
              />
              <button className="chat-send-btn" onClick={handleEscalateQuery} style={{ width: 'auto', padding: '0 0.8rem' }}>
                Submit Query
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;