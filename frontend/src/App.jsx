import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const initialTree = {
  name: 'root',
  children: [
    {
      name: 'child1',
      children: [
        { name: 'child1-child1', data: 'c1-c1 Hello' },
        { name: 'child1-child2', data: 'c1-c2 JS' },
      ],
    },
    { name: 'child2', data: 'c2 World' },
  ],
};

const nextUiId = (() => {
  let counter = 1;
  return () => `node-${counter++}`;
})();

function attachUiState(node) {
  const withUi = {
    ...node,
    _uiId: nextUiId(),
    _collapsed: false,
    _editingName: false,
  };

  if (Array.isArray(withUi.children)) {
    withUi.children = withUi.children.map(attachUiState);
  }

  return withUi;
}

function stripToExport(node) {
  const clean = { name: node.name };

  if (Array.isArray(node.children)) {
    clean.children = node.children.map(stripToExport);
  } else {
    clean.data = node.data ?? '';
  }

  return clean;
}

function cloneTree(tree) {
  return JSON.parse(JSON.stringify(tree));
}

function getNodeAtPath(tree, path) {
  let cursor = tree;

  for (const index of path) {
    cursor = cursor.children[index];
  }

  return cursor;
}

function TagView({ node, path, onToggleCollapse, onEditNameStart, onEditNameCommit, onDataChange, onAddChild }) {
  return (
    <div className="tag-card">
      <div className="tag-header">
        <button className="collapse-btn" type="button" onClick={() => onToggleCollapse(path)}>
          {node._collapsed ? '>' : 'v'}
        </button>

        {!node._editingName ? (
          <button className="name-btn" type="button" onClick={() => onEditNameStart(path)}>
            {node.name}
          </button>
        ) : (
          <input
            className="name-input"
            defaultValue={node.name}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onEditNameCommit(path, event.currentTarget.value.trim() || 'Untitled Tag');
              }
            }}
            onBlur={(event) => onEditNameCommit(path, event.currentTarget.value.trim() || 'Untitled Tag')}
          />
        )}

        <button className="add-child-btn" type="button" onClick={() => onAddChild(path)}>
          Add Child
        </button>
      </div>

      {!node._collapsed && (
        <div className="tag-body">
          {Array.isArray(node.children) ? (
            <div className="children-wrap">
              {node.children.map((child, index) => (
                <TagView
                  key={child._uiId}
                  node={child}
                  path={[...path, index]}
                  onToggleCollapse={onToggleCollapse}
                  onEditNameStart={onEditNameStart}
                  onEditNameCommit={onEditNameCommit}
                  onDataChange={onDataChange}
                  onAddChild={onAddChild}
                />
              ))}
            </div>
          ) : (
            <div className="data-row">
              <label htmlFor={node._uiId}>Data</label>
              <input
                id={node._uiId}
                className="data-input"
                value={node.data ?? ''}
                onChange={(event) => onDataChange(path, event.currentTarget.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const title = useMemo(() => 'AIMonk Nested Tags Tree', []);

  useEffect(() => {
    async function fetchTrees() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_BASE}/trees`);
        if (!response.ok) {
          throw new Error(`Failed to fetch trees (${response.status})`);
        }

        const payload = await response.json();
        const records = Array.isArray(payload) ? payload : [];

        if (records.length === 0) {
          setTrees([
            {
              id: null,
              tree: attachUiState(initialTree),
              exportText: '',
            },
          ]);
        } else {
          setTrees(
            records.map((record) => ({
              id: record.id,
              tree: attachUiState(record.tree),
              exportText: JSON.stringify(record.tree),
            }))
          );
        }
      } catch (fetchError) {
        setError(fetchError.message || 'Unable to fetch saved trees.');
        setTrees([
          {
            id: null,
            tree: attachUiState(initialTree),
            exportText: '',
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchTrees();
  }, []);

  const updateTreeAt = (treeIndex, updater) => {
    setTrees((current) =>
      current.map((entry, idx) => {
        if (idx !== treeIndex) {
          return entry;
        }

        const nextTree = cloneTree(entry.tree);
        updater(nextTree);
        return { ...entry, tree: nextTree };
      })
    );
  };

  const onToggleCollapse = (treeIndex, path) => {
    updateTreeAt(treeIndex, (tree) => {
      const node = getNodeAtPath(tree, path);
      node._collapsed = !node._collapsed;
    });
  };

  const onEditNameStart = (treeIndex, path) => {
    updateTreeAt(treeIndex, (tree) => {
      const node = getNodeAtPath(tree, path);
      node._editingName = true;
    });
  };

  const onEditNameCommit = (treeIndex, path, value) => {
    updateTreeAt(treeIndex, (tree) => {
      const node = getNodeAtPath(tree, path);
      node.name = value;
      node._editingName = false;
    });
  };

  const onDataChange = (treeIndex, path, value) => {
    updateTreeAt(treeIndex, (tree) => {
      const node = getNodeAtPath(tree, path);
      node.data = value;
    });
  };

  const onAddChild = (treeIndex, path) => {
    updateTreeAt(treeIndex, (tree) => {
      const node = getNodeAtPath(tree, path);
      const newChild = attachUiState({ name: 'New Child', data: 'Data' });

      if (!Array.isArray(node.children)) {
        delete node.data;
        node.children = [newChild];
      } else {
        node.children.push(newChild);
      }

      node._collapsed = false;
    });
  };

  const onExport = async (treeIndex) => {
    const entry = trees[treeIndex];
    const exportPayload = stripToExport(entry.tree);
    const exportString = JSON.stringify(exportPayload);

    setTrees((current) =>
      current.map((treeEntry, idx) => (idx === treeIndex ? { ...treeEntry, exportText: exportString } : treeEntry))
    );

    const method = entry.id ? 'PUT' : 'POST';
    const endpoint = entry.id ? `${API_BASE}/trees/${entry.id}` : `${API_BASE}/trees`;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tree: exportPayload }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save tree (${response.status})`);
      }

      const saved = await response.json();

      setTrees((current) =>
        current.map((treeEntry, idx) => (idx === treeIndex ? { ...treeEntry, id: saved.id ?? treeEntry.id } : treeEntry))
      );
    } catch (saveError) {
      setError(saveError.message || 'Unable to save tree.');
    }
  };

  if (loading) {
    return <main className="page">Loading saved trees...</main>;
  }

  return (
    <main className="page">
      <h1>{title}</h1>
      {error && <p className="error">{error}</p>}

      <section className="tree-list">
        {trees.map((entry, treeIndex) => (
          <article className="tree-panel" key={`tree-${entry.id ?? treeIndex}`}>
            <TagView
              node={entry.tree}
              path={[]}
              onToggleCollapse={(path) => onToggleCollapse(treeIndex, path)}
              onEditNameStart={(path) => onEditNameStart(treeIndex, path)}
              onEditNameCommit={(path, value) => onEditNameCommit(treeIndex, path, value)}
              onDataChange={(path, value) => onDataChange(treeIndex, path, value)}
              onAddChild={(path) => onAddChild(treeIndex, path)}
            />

            <button className="export-btn" type="button" onClick={() => onExport(treeIndex)}>
              Export
            </button>

            {entry.exportText && <pre className="export-output">{entry.exportText}</pre>}
          </article>
        ))}
      </section>
    </main>
  );
}
