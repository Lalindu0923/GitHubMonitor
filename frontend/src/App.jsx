import { useState, useEffect, useRef } from 'react';

function DiffFile({ file }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="diff-file">
      <div 
        className="diff-header" 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        title="Click to expand/collapse"
      >
        <span className="diff-filename">
          <span style={{ 
            marginRight: '8px', 
            display: 'inline-block', 
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
            transition: 'transform 0.2s',
            fontSize: '0.8em'
          }}>▶</span>
          {file.filename}
        </span>
        <span className="diff-stats">
          <span className="diff-status-badge">{file.status}</span>
          <span className="additions">+{file.additions}</span>
          <span className="deletions">-{file.deletions}</span>
        </span>
      </div>
      {isExpanded && file.patch && (
        <pre className="diff-patch">
          {file.patch.split('\n').map((line, lIdx) => {
            let className = 'diff-line';
            if (line.startsWith('+')) className += ' diff-line-add';
            else if (line.startsWith('-')) className += ' diff-line-delete';
            else if (line.startsWith('@@')) className += ' diff-line-info';
            return <div key={lIdx} className={className}>{line}</div>;
          })}
        </pre>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' or 'scheduler'
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  
  // Form Inputs
  const [githubUsername, setGithubUsername] = useState('');
  const [repoName, setRepoName] = useState('');
  const [formStatus, setFormStatus] = useState({ status: 'idle', message: '' });
  const [triggerStatus, setTriggerStatus] = useState({ status: 'idle', message: '' });

  const terminalEndRef = useRef(null);

  // Fetch repositories from backend
  const fetchRepositories = async () => {
    try {
      const response = await fetch('http://localhost:3000/repos');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    }
  };

  // Fetch analysis history from backend
  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:3000/repos/results');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching analysis history:', error);
    }
  };

  // Add a new repository (sends separate username and repoName)
  const handleAddRepo = async (e) => {
    e.preventDefault();
    const username = githubUsername.trim();
    const name = repoName.trim();
    if (!username || !name) return;

    setFormStatus({ status: 'loading', message: 'Saving repository...' });
    try {
      const response = await fetch('http://localhost:3000/repos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, repoName: name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add repository');
      }

      setFormStatus({ status: 'success', message: 'Repository saved to JSON!' });
      setGithubUsername('');
      setRepoName('');
      fetchRepositories();
      
      setTimeout(() => setFormStatus({ status: 'idle', message: '' }), 3000);
    } catch (error) {
      setFormStatus({ status: 'error', message: error.message });
    }
  };

  // Delete a repository by ID
  const handleDeleteRepo = async (id) => {
    if (!confirm('Are you sure you want to remove this repository from tracking?')) return;
    try {
      const response = await fetch(`http://localhost:3000/repos/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchRepositories();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete repository');
      }
    } catch (error) {
      console.error('Error deleting repository:', error);
    }
  };

  // Manually trigger check
  const handleTriggerCheck = async () => {
    setTriggerStatus({ status: 'loading', message: 'Triggering system scan...' });
    try {
      const response = await fetch('http://localhost:3000/repos/trigger', {
        method: 'POST',
      });
      if (response.ok) {
        setTriggerStatus({ status: 'success', message: 'Scan triggered! Redirecting...' });
        
        // Clear status and switch to live feed after 1.2 seconds
        setTimeout(() => {
          setTriggerStatus({ status: 'idle', message: '' });
          setActiveTab('live');
        }, 1200);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger check');
      }
    } catch (error) {
      setTriggerStatus({ status: 'error', message: error.message });
    }
  };

  // Load initial data
  useEffect(() => {
    fetchRepositories();
    fetchHistory();
  }, []);

  // Set up EventSource for SSE logs
  useEffect(() => {
    let es;
    try {
      es = new EventSource('http://localhost:3000/stream/logs');
      
      es.onopen = () => {
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const logData = JSON.parse(event.data);
          setLogs((prev) => [...prev, logData]);
          
          // Re-fetch analysis history if a new scan/webhook analysis finishes
          if (logData.message && (
            logData.message.includes('analyzed successfully') || 
            logData.message.includes('complete')
          )) {
            fetchHistory();
          }
        } catch (err) {
          console.error('Error parsing log:', err);
        }
      };

      es.onerror = (err) => {
        console.error('SSE connection error:', err);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect to log stream:', error);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour12: false });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'score-green';
    if (score >= 50) return 'score-orange';
    return 'score-red';
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <svg className="logo-icon" viewBox="0 0 24 24" width="32" height="32">
            <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/>
          </svg>
          <div>
            <h1>GitHubMonitor <span className="version-pill">v2</span></h1>
            <p className="subtitle">Real-time Continuous Code Analysis & Integrity Auditor</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`} 
            onClick={() => setActiveTab('live')}
          >
            <span className={`live-pulse-dot ${isConnected ? 'active' : 'inactive'}`}></span>
            Live Feed & Terminal
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scheduler' ? 'active' : ''}`} 
            onClick={() => setActiveTab('scheduler')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: '6px' }}>
              <path fill="currentColor" d="M19 19H5V8h14m0-5h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-3 12H8v-2h8v2Z"/>
            </svg>
            Repositories & Scheduler
          </button>
        </nav>
      </header>

      {activeTab === 'live' ? (
        /* LIVE FEED PAGE */
        <div className="tab-content">
          <div className="terminal-grid">
            {/* Log Stream Terminal */}
            <div className="terminal-container">
              <div className="terminal-header">
                <div className="terminal-controls">
                  <div className="control-btn close"></div>
                  <div className="control-btn minimize"></div>
                  <div className="control-btn maximize"></div>
                </div>
                <div className="terminal-title">live_logs@githubmonitor ~ sse-client</div>
                <div className="status-indicator">
                  {isConnected ? 'Live' : 'Reconnecting...'}
                  <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
                </div>
              </div>

              <div className="terminal-body">
                {logs.length === 0 ? (
                  <div className="log-empty">Waiting for events from GitHub webhooks or scheduler...</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="log-entry">
                      <span className="log-time">[{formatTime(log.timestamp)}]</span>
                      <span className={`log-level-${log.level || 'info'}`}>{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>

          <div className="live-body-layout">
            {/* Analysis History Feed */}
            <div className="analysis-feed-container">
              <h2>Analyzed Commits History</h2>
              {history.length === 0 ? (
                <div className="history-empty-card">
                  <p>No commits analyzed yet.</p>
                  <span className="helper-text">Trigger a check manually in the Scheduler page or push code to a tracked repository.</span>
                </div>
              ) : (
                <div className="history-grid">
                  {history.map((item) => {
                    const commitData = item.data;
                    const aiResult = commitData.result;
                    const shortSha = commitData.sha?.substring(0, 7) || 'unknown';
                    const hasAuditDetails = aiResult.raw_llm_output && 
                      (aiResult.raw_llm_output.strengths || aiResult.raw_llm_output.risks || aiResult.raw_llm_output.suggestions);
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`commit-card ${selectedCommit?.id === item.id ? 'active' : ''}`}
                        onClick={() => setSelectedCommit(item)}
                      >
                        <div className="commit-card-header">
                          <span className="commit-repo">{commitData.repository}</span>
                          <span className="commit-time">{formatDate(commitData.timestamp || item.id)}</span>
                        </div>
                        
                        <div className="commit-card-body">
                          <div className="commit-message-row">
                            <span className="commit-sha">`{shortSha}`</span>
                            <span className="commit-msg">{aiResult.raw_llm_output?.summary || aiResult.ai_review || 'No message'}</span>
                          </div>
                          
                          <div className="commit-metrics">
                            <div className="commit-stats-pills">
                              <span className="stats-pill files">{aiResult.files_changed || commitData.files?.length || 0} files</span>
                              <span className="stats-pill additions">+{aiResult.additions || 0}</span>
                              <span className="stats-pill deletions">-{aiResult.deletions || 0}</span>
                            </div>
                            
                            <div className={`score-badge ${getScoreColor(aiResult.score)}`}>
                              <span className="score-val">{aiResult.score}</span>
                              <span className="score-lbl">score</span>
                            </div>
                          </div>
                          
                          {/* Rich AI Review details */}
                          {hasAuditDetails && (
                            <div className="audit-summary-panel">
                              {aiResult.raw_llm_output.strengths?.length > 0 && (
                                <div className="quick-audit-tag strength">
                                  <span>✅ Strengths detected</span>
                                </div>
                              )}
                              {aiResult.raw_llm_output.risks?.length > 0 && (
                                <div className="quick-audit-tag risk">
                                  <span>⚠️ Risks identified</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="card-footer">
                            <span className="verdict-label">Verdict: <strong className={`verdict-${aiResult.result}`}>{aiResult.result}</strong></span>
                            <span className="click-prompt">Click to view diff patches</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Commit Details & Diff Viewer Column */}
            <div className="analysis-viewer-container">
              <h2>Commit Audit Details & Diff</h2>
              {selectedCommit ? (
                <div className="viewer-scroll-container">
                  <div className="viewer-header-card">
                    <div className="header-meta">
                      <h3>{selectedCommit.data.repository}</h3>
                      <div className="sha-links">
                        <span className="sha-code">SHA: {selectedCommit.data.sha}</span>
                        <a 
                          href={`https://github.com/${selectedCommit.data.repository}/commit/${selectedCommit.data.sha}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="github-link-btn"
                        >
                          View on GitHub
                          <svg viewBox="0 0 24 24" width="14" height="14" style={{ marginLeft: '4px' }}>
                            <path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L18.6 5H14V3m-5 2h3v2H9v12h12v-3h2v5H7V5h2Z"/>
                          </svg>
                        </a>
                      </div>
                      <span className="analysed-at">Audited on {formatDate(selectedCommit.data.timestamp || selectedCommit.id)}</span>
                    </div>

                    <div className="audit-metrics-row">
                      <div className="metric-box">
                        <span className="val">{selectedCommit.data.result.score} / 100</span>
                        <span className="lbl">AI Code Quality Score</span>
                      </div>
                      <div className="metric-box">
                        <span className={`val verdict-${selectedCommit.data.result.result}`}>{selectedCommit.data.result.result}</span>
                        <span className="lbl">Audit Verdict</span>
                      </div>
                    </div>
                  </div>

                  {/* AI review box */}
                  <div className="review-block">
                    <h3>AI Summary Analysis</h3>
                    <p className="review-text">
                      {selectedCommit.data.result.ai_review || selectedCommit.data.result.raw_llm_output?.summary}
                    </p>
                  </div>

                  {/* Detailed strengths, risks, suggestions */}
                  {selectedCommit.data.result.raw_llm_output && (
                    <div className="full-audit-report">
                      <h3>Detailed Audit Report</h3>
                      
                      {selectedCommit.data.result.raw_llm_output.strengths?.length > 0 && (
                        <div className="report-section strengths">
                          <h4>Code Strengths & Best Practices</h4>
                          <ul>
                            {Array.isArray(selectedCommit.data.result.raw_llm_output.strengths) ? (
                              selectedCommit.data.result.raw_llm_output.strengths.map((item, idx) => (
                                <li key={idx}>✅ {item}</li>
                              ))
                            ) : (
                              <li>✅ {selectedCommit.data.result.raw_llm_output.strengths}</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {selectedCommit.data.result.raw_llm_output.risks?.length > 0 && (
                        <div className="report-section risks">
                          <h4>Code Risks & Concerns</h4>
                          <ul>
                            {Array.isArray(selectedCommit.data.result.raw_llm_output.risks) ? (
                              selectedCommit.data.result.raw_llm_output.risks.map((item, idx) => (
                                <li key={idx}>⚠️ {item}</li>
                              ))
                            ) : (
                              <li>⚠️ {selectedCommit.data.result.raw_llm_output.risks}</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {selectedCommit.data.result.raw_llm_output.suggestions?.length > 0 && (
                        <div className="report-section suggestions">
                          <h4>AI Refactoring Suggestions</h4>
                          <ul>
                            {Array.isArray(selectedCommit.data.result.raw_llm_output.suggestions) ? (
                              selectedCommit.data.result.raw_llm_output.suggestions.map((item, idx) => (
                                <li key={idx}>💡 {item}</li>
                              ))
                            ) : (
                              <li>💡 {selectedCommit.data.result.raw_llm_output.suggestions}</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Code changes list */}
                  <div className="diff-viewer-container">
                    <h2>Changed Files & Code Patches</h2>
                    {selectedCommit.files && selectedCommit.files.length > 0 ? (
                      selectedCommit.files.map((file, idx) => (
                        <DiffFile key={idx} file={file} />
                      ))
                    ) : (
                      <div className="no-diffs-fallback">No file patches saved for this commit.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="select-prompt-placeholder">
                  <svg viewBox="0 0 24 24" width="64" height="64">
                    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M4 7h3M4 12h5M4 17h3"/>
                  </svg>
                  <p>Select a commit card from the history feed to inspect detailed AI feedback and view file code differences.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SCHEDULER PAGE */
        <div className="tab-content scheduler-layout">
          <div className="scheduler-left">
            {/* Tracked Repositories List */}
            <div className="card-panel">
              <div className="panel-header">
                <h2>Tracked Repositories</h2>
                <span className="panel-badge">{repositories.length} Configured</span>
              </div>
              <p className="panel-description">These repositories are scanned daily for commit activity. Push webhooks will also trigger auto-analysis for these repos.</p>
              
              {repositories.length === 0 ? (
                <div className="repos-empty">
                  No repositories are currently tracked. Use the form to configure one.
                </div>
              ) : (
                <div className="repos-grid">
                  {repositories.map((repo) => (
                    <div key={repo.id} className="repo-tracking-card">
                      <div className="repo-info-row">
                        <svg className="repo-git-icon" viewBox="0 0 24 24" width="20" height="20">
                          <path fill="currentColor" d="M4 10.4V20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9.6a4 4 0 0 0-2-3.47V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v1.93A4 4 0 0 0 4 10.4M8 5h8v2H8V5m4 10a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"/>
                        </svg>
                        <div className="repo-titles">
                          <span className="owner-title">{repo.username}</span>
                          <span className="name-title">{repo.repoName}</span>
                        </div>
                      </div>
                      
                      <div className="repo-url-link">
                        <a href={repo.repoUrl} target="_blank" rel="noopener noreferrer">
                          {repo.repoUrl}
                        </a>
                      </div>

                      <div className="repo-card-actions">
                        <button 
                          className="delete-repo-btn"
                          onClick={() => handleDeleteRepo(repo.id)}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: '6px' }}>
                            <path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12Z"/>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="scheduler-right">
            {/* Add Repository Form */}
            <div className="card-panel">
              <h2>Add New Repository</h2>
              <p className="panel-description">Add a repository to begin monitoring commits. The URL will be generated automatically and saved to the JSON database.</p>
              
              <form onSubmit={handleAddRepo} className="modern-form">
                <div className="form-group">
                  <label htmlFor="username">GitHub Username / Owner</label>
                  <input
                    id="username"
                    type="text"
                    className="repo-input"
                    placeholder="e.g. Lalindu0923"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="reponame">Repository Name</label>
                  <input
                    id="reponame"
                    type="text"
                    className="repo-input"
                    placeholder="e.g. GitHubMonitor-V2"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    required
                  />
                </div>
                
                {githubUsername && repoName && (
                  <div className="generated-preview">
                    <span className="preview-label">Generated URL:</span>
                    <code className="preview-url">https://github.com/{githubUsername}/{repoName}</code>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="submit-btn" 
                  disabled={formStatus.status === 'loading'}
                >
                  {formStatus.status === 'loading' ? 'Saving...' : 'Add & Track Repository'}
                </button>
              </form>

              {formStatus.message && (
                <div className={`form-message ${formStatus.status}`}>
                  {formStatus.message}
                </div>
              )}
            </div>

            {/* Scheduler Details Card */}
            <div className="card-panel scheduler-control-panel">
              <h2>Scheduler Status</h2>
              <div className="scheduler-status-row">
                <span className="status-label">Cron Job Schedule:</span>
                <span className="cron-badge">10 0 * * *</span>
              </div>
              <p className="scheduler-run-time">Runs automatically every day at <strong>12:10 AM (00:10)</strong>.</p>
              
              <div className="manual-run-block">
                <h3>Trigger Scan Manually</h3>
                <p>Run check now to query all tracked repositories for today's commits, run LLM analysis, and record reviews.</p>
                
                <button 
                  className="trigger-btn" 
                  onClick={handleTriggerCheck}
                  disabled={triggerStatus.status === 'loading' || repositories.length === 0}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: '8px' }}>
                    <path fill="currentColor" d="M8 5.14v14l11-7-11-7Z"/>
                  </svg>
                  {triggerStatus.status === 'loading' ? 'Running scanner...' : 'Run Scanner Now'}
                </button>
                
                {repositories.length === 0 && (
                  <p className="error-note">⚠️ You must add at least one repository to run a scan.</p>
                )}

                {triggerStatus.message && (
                  <div className={`form-message ${triggerStatus.status}`} style={{ marginTop: '1rem' }}>
                    {triggerStatus.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
