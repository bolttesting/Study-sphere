// src/components/MessageBubble.js  ── FULL REPLACEMENT
// Renders bot messages as formatted markdown. No extra library needed.
import React from 'react';
import './chatbot.css';

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight markdown → JSX renderer
// Handles: headings, bold, italic, inline-code, code blocks, bullet lists,
//          numbered lists, horizontal rules, and plain paragraphs.
// ─────────────────────────────────────────────────────────────────────────────

function renderInline(text) {
  // Process inline formatting: **bold**, *italic*, `code`
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(<code key={match.index} className="md-inline-code">{match[4]}</code>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : text;
}

function MarkdownContent({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  let keyCounter = 0;
  const key = () => keyCounter++;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ────────────────────────────────────────────────────
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={key()} className="md-code-block">
          {lang && <div className="md-code-lang">{lang}</div>}
          <pre><code>{codeLines.join('\n')}</code></pre>
        </div>
      );
      i++; // skip closing ```
      continue;
    }

    // ── Headings ─────────────────────────────────────────────────────────────
    if (line.startsWith('### ')) {
      elements.push(<h4 key={key()} className="md-h3">{renderInline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={key()} className="md-h2">{renderInline(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={key()} className="md-h1">{renderInline(line.slice(2))}</h2>);
      i++; continue;
    }

    // ── Horizontal rule ──────────────────────────────────────────────────────
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push(<hr key={key()} className="md-hr" />);
      i++; continue;
    }

    // ── Bullet list ──────────────────────────────────────────────────────────
    if (/^(\s*[-*+] )/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*[-*+] )/.test(lines[i])) {
        items.push(
          <li key={key()}>{renderInline(lines[i].replace(/^\s*[-*+] /, ''))}</li>
        );
        i++;
      }
      elements.push(<ul key={key()} className="md-ul">{items}</ul>);
      continue;
    }

    // ── Numbered list ────────────────────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(
          <li key={key()}>{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>
        );
        i++;
      }
      elements.push(<ol key={key()} className="md-ol">{items}</ol>);
      continue;
    }

    // ── Blockquote ───────────────────────────────────────────────────────────
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={key()} className="md-blockquote">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // ── Empty line → spacer ──────────────────────────────────────────────────
    if (line.trim() === '') {
      elements.push(<div key={key()} className="md-spacer" />);
      i++; continue;
    }

    // ── Paragraph ────────────────────────────────────────────────────────────
    elements.push(
      <p key={key()} className="md-p">{renderInline(line)}</p>
    );
    i++;
  }

  return <div className="md-content">{elements}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MessageBubble component
// ─────────────────────────────────────────────────────────────────────────────

const MessageBubble = ({ sender, text, sources = [], isTyping = false }) => {
  const isUser = sender === 'user';

  return (
    <div className={`message-row ${isUser ? 'from-user' : 'from-bot'}`}>
      {!isUser && (
        <div className="message-avatar">
          <span>🤖</span>
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'user' : 'bot'}`}>
        {isTyping ? (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : isUser ? (
          // User messages stay as plain text
          <p style={{ margin: 0 }}>{text}</p>
        ) : (
          // Bot messages get full markdown rendering
          <>
            <MarkdownContent text={text} />

            {/* RAG source badges */}
            {sources && sources.length > 0 && (
              <div className="message-sources">
                <span className="sources-label">📎 Sources:</span>
                {sources.map((src, idx) => (
                  <span key={idx} className="source-badge">{src}</span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;