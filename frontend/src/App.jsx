import { useState, useEffect, useRef } from 'react';

const REPOS = [
  { id: 'backend', title: 'backend-stream ~ node server.js', streamUrl: 'http://localhost:3000/stream/logs' },
];

function DiffFile({ file }) {
  const [isExpanded, setIsExpanded] = useState(false);

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
  const [logsMap, setLogsMap] = useState(() => REPOS.reduce((acc, r) => ({ ...acc, [r.id]: [] }), {}));
  const [connectedMap, setConnectedMap] = useState(() => REPOS.reduce((acc, r) => ({ ...acc, [r.id]: false }), {}));
  const endRefs = useRef(REPOS.reduce((acc, r) => ({ ...acc, [r.id]: null }), {}));
  const [changedFiles, setChangedFiles] = useState(null);
  const [githubUsername, setGithubUsername] = useState('');
  const [repoName, setRepoName] = useState('');
  const [formStatus, setFormStatus] = useState({ status: 'idle', message: '' });

  const handleAddRepo = async (e) => {
    e.preventDefault();
    const trimmedUsername = githubUsername.trim();
    const trimmedRepoName = repoName.trim();
    if (!trimmedUsername || !trimmedRepoName) return;

    const fullRepoUrl = `https://github.com/${encodeURIComponent(trimmedUsername)}/${encodeURIComponent(trimmedRepoName)}`;

    setFormStatus({ status: 'loading', message: 'Adding repository...' });
    try {
      const response = await fetch('http://localhost:3000/repos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: fullRepoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add repository');
      }

      setFormStatus({ status: 'success', message: 'Repository added successfully!' });
  setGithubUsername('');
  setRepoName('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setFormStatus({ status: 'idle', message: '' }), 3000);
    } catch (error) {
      setFormStatus({ status: 'error', message: error.message });
    }
  };

  // Auto-scroll per repo when new logs arrive
  useEffect(() => {
    REPOS.forEach((r) => {
      endRefs.current[r.id]?.scrollIntoView?.({ behavior: 'smooth' });
    });
  }, [logsMap]);

  useEffect(() => {
    const sources = [];

    REPOS.forEach((repo) => {
      if (!repo.streamUrl) return;

      try {
        const es = new EventSource(repo.streamUrl);
        sources.push(es);

        es.onopen = () => {
          setConnectedMap((m) => ({ ...m, [repo.id]: true }));
        };

        es.onmessage = (event) => {
          try {
            const logData = JSON.parse(event.data);
            if (logData.data && logData.data.changedFiles) {
              setChangedFiles(logData.data.changedFiles);
            }
            setLogsMap((prev) => ({ ...prev, [repo.id]: [...prev[repo.id], logData] }));
          } catch (err) {
            console.error('Error parsing log data for', repo.id, err);
          }
        };

        es.onerror = (err) => {
          console.error('SSE error for', repo.id, err);
          setConnectedMap((m) => ({ ...m, [repo.id]: false }));
        };
      } catch (err) {
        console.error('Failed to open EventSource for', repo.id, err);
      }
    });

    return () => {
      sources.forEach((s) => s.close());
    };
  }, []);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour12: false });
  };

  return (
    <div className="app-container">
      <header>
        <h1>GitHubMonitor Terminal</h1>
        <p className="subtitle">Real-time AI Analysis Logs</p>
      </header>

      <div className="add-repo-form-container">
        <form onSubmit={handleAddRepo} className="add-repo-form">
          <input
            type="text"
            className="repo-input"
            placeholder="GitHub username"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            required
          />
          <input
            type="text"
            className="repo-input"
            placeholder="Repository name"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            required
          />
          <button type="submit" className="repo-submit-btn" disabled={formStatus.status === 'loading'}>
            {formStatus.status === 'loading' ? 'Adding...' : 'Add Repository'}
          </button>
        </form>
        {formStatus.message && (
          <div className={`form-message ${formStatus.status}`}>
            {formStatus.message}
          </div>
        )}
      </div>

      <div className="terminal-grid">
        {REPOS.map((repo) => {
          const logs = logsMap[repo.id] || [];
          const isConnected = connectedMap[repo.id];

          return (
            <div key={repo.id} className="terminal-container">
              <div className="terminal-header">
                <div className="terminal-controls">
                  <div className="control-btn close"></div>
                  <div className="control-btn minimize"></div>
                  <div className="control-btn maximize"></div>
                </div>
                <div className="terminal-title">{repo.title}</div>
                <div className="status-indicator">
                  {isConnected ? 'Connected' : repo.streamUrl ? 'Reconnecting...' : 'No stream configured'}
                  <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
                </div>
              </div>

              <div className="terminal-body">
                {logs.length === 0 ? (
                  <div className="log-empty">{repo.streamUrl ? 'Waiting for events...' : 'No stream configured for this repo'}</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="log-entry">
                      <span className="log-time">[{formatTime(log.timestamp)}]</span>
                      <span className={`log-level-${log.level || 'info'}`}>{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={(el) => (endRefs.current[repo.id] = el)} />
                {isConnected && (
                  <div>
                    <span className="log-time">[{formatTime(new Date())}]</span>
                    <span>Waiting for input</span>
                    <span className="cursor"></span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {changedFiles && (
        <div className="diff-viewer-container">
          <h2>Changed Files</h2>
          {changedFiles.map((file, idx) => (
            <DiffFile key={idx} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
