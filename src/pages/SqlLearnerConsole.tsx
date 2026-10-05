import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  MessageSquare,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowRight,
  Database,
  Send,
  Download,
  Filter,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  Zap,
  Bot
} from 'lucide-react'
import { sandboxStore, type UserSandbox, type SandboxTables } from '../lib/sandboxStore'
import { SqlEngine, type SqlExecutionResult } from '../lib/sqlEngine'
import { SQL_HANDBOOK, type SqlHandbookItem, type SqlTopicCategory } from '../data/sqlHandbook'
import { AiSqlMentor, type AiErrorDiagnosis } from '../lib/aiSqlMentor'

interface SqlLearnerConsoleProps {
  userEmail: string
  tables: SandboxTables
  onTablesUpdated?: (newTables: SandboxTables) => void
  notify: (msg: string, kind?: 'success' | 'error') => void
}

const TEMPLATE_QUERIES = [
  { label: 'All Consumers', sql: 'SELECT * FROM consumers LIMIT 10;' },
  { label: 'High Usage Users', sql: 'SELECT name, account, zone, usage FROM consumers WHERE usage >= 200 ORDER BY usage DESC;' },
  { label: 'Consumer & Meter JOIN', sql: `SELECT c.name, c.account, m.serial, m.status AS meter_status\nFROM consumers c\nLEFT JOIN meters m ON c.id = m.consumerId\nORDER BY c.name ASC;` },
  { label: 'Zone Load Aggregates', sql: `SELECT zone, COUNT(*) AS consumers, SUM(usage) AS total_kwh, AVG(usage) AS avg_kwh\nFROM consumers\nGROUP BY zone\nORDER BY total_kwh DESC;` },
  { label: 'Revenue by Status', sql: `SELECT status, COUNT(*) AS count, SUM(amount) AS total_inr\nFROM bills\nGROUP BY status;` },
  { label: 'Test Transactions', sql: `BEGIN;\nUPDATE consumers SET plan = 'Commercial' WHERE usage > 250;\n-- Check result, then run:\nROLLBACK;` },
  { label: 'Show Tables', sql: 'SHOW TABLES;' }
]

export function SqlLearnerConsole({ userEmail, tables, onTablesUpdated, notify }: SqlLearnerConsoleProps) {
  // 1. Sandbox synchronization
  const sandbox = useMemo(() => sandboxStore.getOrInit(userEmail, tables), [userEmail, tables])
  const [editorSql, setEditorSql] = useState<string>(() => sandbox.editorDraft || TEMPLATE_QUERIES[0].sql)
  const [executionResult, setExecutionResult] = useState<SqlExecutionResult | null>(null)
  const [activeTab, setActiveTab] = useState<'handbook' | 'chat'>('handbook')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Handbook state
  const [handbookSearch, setHandbookSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState(() => sandbox.chatHistory || [])
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Sync draft to store with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      sandboxStore.setEditorDraft(userEmail, editorSql)
    }, 500)
    return () => clearTimeout(timer)
  }, [editorSql, userEmail])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, activeTab])

  // Auto-run first query on mount
  useEffect(() => {
    if (!executionResult) {
      handleRunQuery(editorSql)
    }
  }, [])

  // Execute SQL
  const handleRunQuery = (sqlToRun?: string) => {
    const query = (sqlToRun || editorSql).trim()
    if (!query) {
      notify('Type a query in the editor first.', 'error')
      return
    }

    const { result, updatedTables } = SqlEngine.execute(query, tables, userEmail)
    setExecutionResult(result)

    // Save to query history
    sandboxStore.addHistory(userEmail, {
      sql: query,
      status: result.status,
      durationMs: result.executionTimeMs,
      rowsAffected: result.rowsAffected,
      errorMessage: result.error?.message
    })

    // If tables mutated, notify app and update store
    if (updatedTables) {
      sandboxStore.updateTables(userEmail, updatedTables)
      if (onTablesUpdated) onTablesUpdated(updatedTables)
      notify(result.message || 'Sandbox tables updated successfully!')
    } else if (result.status === 'SUCCESS') {
      notify(`Executed in ${result.executionTimeMs}ms`, 'success')
    }
  }

  // Format SQL simple indentation
  const handleFormatSql = () => {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'LEFT JOIN', 'INNER JOIN', 'JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'SET', 'VALUES', 'INSERT INTO', 'UPDATE', 'DELETE FROM']
    let formatted = editorSql
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi')
      formatted = formatted.replace(regex, kw.toUpperCase())
    })
    setEditorSql(formatted)
    notify('SQL formatted.')
  }

  // Clear Editor
  const handleClearEditor = () => {
    setEditorSql('')
    setExecutionResult(null)
  }

  // Copy results to clipboard
  const handleCopyResults = () => {
    if (!executionResult || !executionResult.rows.length) return
    const text = JSON.stringify(executionResult.rows, null, 2)
    navigator.clipboard.writeText(text)
    notify('Results JSON copied to clipboard!')
  }

  // Export results CSV
  const handleExportCsv = () => {
    if (!executionResult || !executionResult.rows.length) return
    const cols = executionResult.columns
    const rows = executionResult.rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))
    const csvContent = [cols.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query-results-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify('CSV exported.')
  }

  // AI Error diagnosis
  const errorDiagnosis: AiErrorDiagnosis | null = useMemo(() => {
    if (executionResult?.status === 'ERROR' && executionResult.error) {
      return AiSqlMentor.diagnoseError(editorSql, executionResult.error.message, tables)
    }
    return null
  }, [executionResult, editorSql, tables])

  // Send message in AI side-chat
  const handleSendChatMessage = (textToSend?: string) => {
    const text = (textToSend || chatInput).trim()
    if (!text) return

    const userMsg = {
      sender: 'user' as const,
      text
    }
    sandboxStore.addChatMessage(userEmail, userMsg)
    setChatMessages(prev => [...prev, { ...userMsg, id: `msg-${Date.now()}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    setChatInput('')

    // Generate response from AI SQL Mentor
    setTimeout(() => {
      const aiResponse = AiSqlMentor.respondToChatQuestion(text, editorSql, executionResult?.error?.message)
      const assistantMsg = {
        sender: 'assistant' as const,
        text: aiResponse.reply,
        fixSuggestion: aiResponse.suggestedQuery
      }
      sandboxStore.addChatMessage(userEmail, assistantMsg)
      setChatMessages(prev => [...prev, { ...assistantMsg, id: `msg-${Date.now() + 1}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    }, 400)
  }

  // Filter handbook topics
  const filteredHandbook = useMemo(() => {
    return SQL_HANDBOOK.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(handbookSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(handbookSearch.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(handbookSearch.toLowerCase()))
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory
      return matchesSearch && matchesCat
    })
  }, [handbookSearch, selectedCategory])

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(SQL_HANDBOOK.map(h => h.category)))]
  }, [])

  return (
    <div className="sql-console-container">
      {/* Top Banner Header */}
      <div className="sql-console-header">
        <div className="sql-header-title">
          <div className="sql-title-row">
            <span className="sql-badge-icon"><Database size={18} /></span>
            <h2>SQL Learner Console</h2>
            <span className="sql-mode-pill">SREC DBMS LAB</span>
          </div>
          <p>
            Write and execute real SQL queries against your personal, cloud-synced Tamil Nadu database sandbox.
          </p>
        </div>

        <div className="sql-header-actions">
          <button
            className={`console-tab-btn ${sidebarOpen && activeTab === 'handbook' ? 'active' : ''}`}
            onClick={() => {
              if (sidebarOpen && activeTab === 'handbook') {
                setSidebarOpen(false)
              } else {
                setSidebarOpen(true)
                setActiveTab('handbook')
              }
            }}
          >
            <BookOpen size={16} />
            <span>Handbook</span>
          </button>

          <button
            className={`console-tab-btn ${sidebarOpen && activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => {
              if (sidebarOpen && activeTab === 'chat') {
                setSidebarOpen(false)
              } else {
                setSidebarOpen(true)
                setActiveTab('chat')
              }
            }}
          >
            <Bot size={16} />
            <span>AI Mentor</span>
            {errorDiagnosis && <span className="error-chat-indicator" />}
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className={`sql-layout-grid ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        {/* Left Column: Editor & Result */}
        <div className="sql-main-panel">
          {/* Query Editor Box */}
          <div className="sql-editor-card">
            <div className="editor-toolbar">
              <div className="template-chips">
                <span className="chips-label">Quick Queries:</span>
                <div className="chips-scroll">
                  {TEMPLATE_QUERIES.map(tmpl => (
                    <button
                      key={tmpl.label}
                      className="tmpl-chip"
                      onClick={() => {
                        setEditorSql(tmpl.sql)
                        handleRunQuery(tmpl.sql)
                      }}
                      title="Load and execute template"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="editor-controls">
                <button className="editor-action-btn" onClick={handleFormatSql} title="Format SQL syntax">
                  <Sparkles size={14} />
                  <span>Format</span>
                </button>
                <button className="editor-action-btn" onClick={handleClearEditor} title="Clear editor">
                  <RotateCcw size={14} />
                  <span>Clear</span>
                </button>
                <button
                  className="editor-run-btn"
                  onClick={() => handleRunQuery()}
                  title="Run SQL (Ctrl + Enter)"
                >
                  <Play size={15} fill="currentColor" />
                  <span>Run Query</span>
                </button>
              </div>
            </div>

            {/* Code Input Area */}
            <div className="editor-textarea-wrapper">
              <textarea
                className="sql-code-input"
                value={editorSql}
                onChange={e => setEditorSql(e.target.value)}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    handleRunQuery()
                  }
                }}
                placeholder="-- Type your SQL query here... (e.g. SELECT * FROM consumers;)"
                rows={8}
                spellCheck={false}
              />
              <div className="editor-hint-row">
                <span>Tip: Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run query immediately</span>
                <span>Auto-saved to cloud</span>
              </div>
            </div>
          </div>

          {/* Results / Error Area */}
          <div className="sql-results-card">
            <div className="results-header">
              <div className="results-status">
                {executionResult ? (
                  executionResult.status === 'SUCCESS' ? (
                    <div className="status-indicator success">
                      <CheckCircle2 size={16} />
                      <b>SUCCESS ({executionResult.queryType})</b>
                      <span>·</span>
                      <small>{executionResult.executionTimeMs} ms</small>
                      <span>·</span>
                      <small>{executionResult.rowsAffected} row(s)</small>
                    </div>
                  ) : (
                    <div className="status-indicator error">
                      <AlertCircle size={16} />
                      <b>ERROR {executionResult.error?.code ? `[${executionResult.error.code}]` : ''}</b>
                      <span>·</span>
                      <small>{executionResult.executionTimeMs} ms</small>
                    </div>
                  )
                ) : (
                  <div className="status-indicator idle">
                    <Database size={16} />
                    <span>Ready to execute SQL query</span>
                  </div>
                )}
              </div>

              {executionResult && executionResult.status === 'SUCCESS' && executionResult.rows.length > 0 && (
                <div className="results-actions">
                  <button className="results-action-btn" onClick={handleCopyResults} title="Copy result rows as JSON">
                    <Copy size={13} />
                    <span>Copy JSON</span>
                  </button>
                  <button className="results-action-btn" onClick={handleExportCsv} title="Export as CSV">
                    <Download size={13} />
                    <span>Export CSV</span>
                  </button>
                </div>
              )}
            </div>

            {/* Content Display: Error Diagnosis OR Data Table */}
            <div className="results-body">
              {executionResult?.status === 'ERROR' && (
                <div className="sql-error-box">
                  <div className="error-headline">
                    <AlertCircle size={20} />
                    <div>
                      <h4>{errorDiagnosis?.errorTitle || 'Query Execution Failed'}</h4>
                      <p className="raw-err-msg">{executionResult.error?.message}</p>
                    </div>
                  </div>

                  {errorDiagnosis && (
                    <div className="ai-diagnosis-panel">
                      <div className="diagnosis-section">
                        <div className="section-tag"><Bot size={13} /> EXPLAINABLE AI ANALYSIS</div>
                        <p className="diagnosis-text">{errorDiagnosis.plainEnglishExplanation}</p>
                      </div>

                      <div className="diagnosis-section">
                        <div className="section-tag"><Sparkles size={13} /> SUGGESTED FIX</div>
                        <div className="fix-sql-block">
                          <code>{errorDiagnosis.suggestedFixSql}</code>
                          <button
                            className="apply-fix-btn"
                            onClick={() => {
                              setEditorSql(errorDiagnosis.suggestedFixSql)
                              handleRunQuery(errorDiagnosis.suggestedFixSql)
                            }}
                          >
                            <span>Apply Fix & Run</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="diagnosis-footer">
                        <small>💡 <strong>Key Concept:</strong> {errorDiagnosis.educationalConcept}</small>
                        <button
                          className="ask-mentor-btn"
                          onClick={() => {
                            setSidebarOpen(true)
                            setActiveTab('chat')
                            handleSendChatMessage(`Can you explain why this query caused an error: "${executionResult.error?.message}"?`)
                          }}
                        >
                          <MessageSquare size={13} />
                          <span>Ask AI Mentor about this</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {executionResult?.status === 'SUCCESS' && (
                <>
                  {executionResult.rows.length === 0 ? (
                    <div className="sql-empty-results">
                      <CheckCircle2 size={32} />
                      <p>{executionResult.message || 'Query executed successfully with 0 rows returned.'}</p>
                    </div>
                  ) : (
                    <div className="sql-table-wrapper">
                      <table className="sql-data-table">
                        <thead>
                          <tr>
                            <th className="row-num-header">#</th>
                            {executionResult.columns.map(col => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {executionResult.rows.map((row, idx) => (
                            <tr key={idx}>
                              <td className="row-num-cell">{idx + 1}</td>
                              {executionResult.columns.map(col => {
                                const val = row[col]
                                const isNull = val === null || val === undefined
                                const isStatus = col.toLowerCase().includes('status')
                                return (
                                  <td key={col} className={isNull ? 'null-cell' : ''}>
                                    {isNull ? (
                                      <i>NULL</i>
                                    ) : isStatus ? (
                                      <span className={`status-tag status-${String(val).toLowerCase()}`}>
                                        {String(val)}
                                      </span>
                                    ) : typeof val === 'number' ? (
                                      Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2)
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {!executionResult && (
                <div className="sql-empty-placeholder">
                  <Database size={36} />
                  <h4>No queries executed yet</h4>
                  <p>Choose a query from the quick chips above or click any command in the Handbook.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Collapsible Drawer (Handbook OR AI Mentor Chat) */}
        {sidebarOpen && (
          <aside className="sql-drawer-panel">
            <div className="drawer-header">
              <div className="drawer-tabs">
                <button
                  className={`drawer-tab-btn ${activeTab === 'handbook' ? 'active' : ''}`}
                  onClick={() => setActiveTab('handbook')}
                >
                  <BookOpen size={15} />
                  <span>SQL Handbook</span>
                </button>
                <button
                  className={`drawer-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  <Bot size={15} />
                  <span>AI Mentor</span>
                </button>
              </div>
              <button className="drawer-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close drawer">
                <X size={16} />
              </button>
            </div>

            {/* HANDBOOK VIEW */}
            {activeTab === 'handbook' && (
              <div className="drawer-body handbook-view">
                <div className="handbook-search-box">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Search queries, joins, aggregates..."
                    value={handbookSearch}
                    onChange={e => setHandbookSearch(e.target.value)}
                  />
                  {handbookSearch && (
                    <button onClick={() => setHandbookSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="category-chips">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="handbook-list">
                  {filteredHandbook.map(item => (
                    <div key={item.id} className="handbook-card">
                      <div className="card-top">
                        <span className={`level-pill level-${item.level.toLowerCase()}`}>{item.level}</span>
                        <span className="card-cat">{item.category}</span>
                      </div>
                      <h5>{item.title}</h5>
                      <p className="card-desc">{item.description}</p>

                      <div className="card-code-block">
                        <pre><code>{item.sql}</code></pre>
                      </div>

                      <div className="card-actions">
                        <button
                          className="card-insert-btn"
                          onClick={() => {
                            setEditorSql(item.sql)
                            notify(`Inserted "${item.title}" into editor.`)
                          }}
                        >
                          Insert
                        </button>
                        <button
                          className="card-run-btn"
                          onClick={() => {
                            setEditorSql(item.sql)
                            handleRunQuery(item.sql)
                          }}
                        >
                          <Play size={12} fill="currentColor" />
                          Run
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredHandbook.length === 0 && (
                    <div className="no-handbook-results">
                      <Search size={24} />
                      <p>No handbook queries match your search.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI MENTOR SIDE-CHAT VIEW */}
            {activeTab === 'chat' && (
              <div className="drawer-body chat-view">
                <div className="chat-intro-card">
                  <div className="intro-avatar"><Bot size={18} /></div>
                  <div className="intro-text">
                    <b>AI Query Mentor</b>
                    <small>Ask questions about SQL syntax, error explanations, or relational theory.</small>
                  </div>
                </div>

                <div className="chat-messages-container">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`chat-bubble-row ${msg.sender}`}>
                      <div className="bubble-content">
                        <div className="bubble-header">
                          <span className="sender-name">{msg.sender === 'user' ? 'You' : 'AI Mentor'}</span>
                          <span className="msg-time">{msg.timestamp}</span>
                        </div>
                        <div className="bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
                          {msg.text}
                        </div>
                        {msg.fixSuggestion && (
                          <div className="chat-sql-suggestion">
                            <pre><code>{msg.fixSuggestion}</code></pre>
                            <button
                              className="chat-run-sql-btn"
                              onClick={() => {
                                setEditorSql(msg.fixSuggestion!)
                                handleRunQuery(msg.fixSuggestion!)
                              }}
                            >
                              <Play size={12} fill="currentColor" />
                              Run this in Editor
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Chat Prompts */}
                <div className="quick-chat-prompts">
                  <button onClick={() => handleSendChatMessage('Why did my last query fail?')}>
                    Why did my query fail?
                  </button>
                  <button onClick={() => handleSendChatMessage('Explain the difference between INNER and LEFT JOIN')}>
                    INNER vs LEFT JOIN
                  </button>
                  <button onClick={() => handleSendChatMessage('How do I use transactions and ROLLBACK?')}>
                    Explain ROLLBACK
                  </button>
                </div>

                {/* Chat Input */}
                <form
                  className="chat-input-bar"
                  onSubmit={e => {
                    e.preventDefault()
                    handleSendChatMessage()
                  }}
                >
                  <input
                    type="text"
                    placeholder="Ask a question or paste an error..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                  />
                  <button type="submit" disabled={!chatInput.trim()} aria-label="Send message">
                    <Send size={15} />
                  </button>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
