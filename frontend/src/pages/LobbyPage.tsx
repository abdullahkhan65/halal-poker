import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { connectSocket } from '../lib/socket';
import { useGameStore } from '../store/game.store';
import type { TableInfo } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';

export function LobbyPage() {
  const [tableName, setTableName] = useState('');
  const { tables, setTables, setTableId } = useGameStore();
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();

  useEffect(() => {
    const socket = connectSocket();
    const fetchTables = () => socket.emit('get_tables', {}, (data: TableInfo[]) => setTables(data ?? []));
    if (socket.connected) fetchTables();
    else socket.once('connect', fetchTables);
    socket.on('tables_updated', setTables);
    return () => { socket.off('connect', fetchTables); socket.off('tables_updated', setTables); };
  }, []);

  function createTable() {
    if (!tableName.trim()) return;
    connectSocket().emit('create_table', { name: tableName }, (table: { id: string }) => {
      setTableId(table.id);
      nav(`/table/${table.id}`);
    });
  }

  function joinTable(tableId: string) { setTableId(tableId); nav(`/table/${tableId}`); }

  const statusLabel: Record<string, string> = { waiting: 'Open', playing: 'In Progress', finished: 'Closed' };
  const statusColor: Record<string, string> = {
    waiting: '#4ade80', playing: '#c9a060', finished: 'rgba(255,255,255,0.2)',
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          display: 'inline-block', padding: '4px 16px', borderRadius: 100, marginBottom: 16,
          background: 'rgba(201,160,96,0.08)', border: '1px solid rgba(201,160,96,0.2)',
          fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(201,160,96,0.7)',
        }}>
          Private Access
        </div>
        <h1 className="font-display shimmer-text" style={{ fontSize: 42, fontWeight: 700, margin: '0 0 8px', letterSpacing: '0.02em' }}>
          The Room
        </h1>
        <p style={{ color: 'rgba(232,220,200,0.35)', fontSize: 14, margin: 0 }}>
          Welcome back, {user?.name}
        </p>
      </div>

      {/* Create table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'rgba(10,10,16,0.8)', borderRadius: 16, padding: 20, marginBottom: 32,
          border: '1px solid rgba(201,160,96,0.12)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(201,160,96,0.5)', marginBottom: 12, fontWeight: 600 }}>
          Open a Private Table
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTable()}
            placeholder="Name your table…"
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,160,96,0.15)',
              color: '#e8dcc8', outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(201,160,96,0.4)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(201,160,96,0.15)')}
          />
          <button onClick={createTable} disabled={!tableName.trim()} style={{
            padding: '11px 24px', borderRadius: 10, cursor: tableName.trim() ? 'pointer' : 'default',
            background: tableName.trim() ? 'linear-gradient(180deg, #e8c97a 0%, #c9a060 100%)' : 'rgba(255,255,255,0.04)',
            border: tableName.trim() ? '1px solid #d4b070' : '1px solid rgba(255,255,255,0.06)',
            color: tableName.trim() ? '#1a0f00' : 'rgba(255,255,255,0.2)',
            fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
            boxShadow: tableName.trim() ? '0 4px 20px rgba(201,160,96,0.3)' : 'none',
          }}>
            Create
          </button>
        </div>
      </motion.div>

      {/* Table list */}
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(201,160,96,0.4)', marginBottom: 14, fontWeight: 600 }}>
          Active Tables — {tables.length}
        </div>

        {tables.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            border: '1px dashed rgba(201,160,96,0.1)', borderRadius: 16,
            color: 'rgba(201,160,96,0.25)', fontSize: 14,
          }}>
            No tables yet. Be the first to open one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tables.map((table, i) => (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
                  background: 'rgba(10,10,16,0.7)', borderRadius: 12,
                  border: '1px solid rgba(201,160,96,0.1)',
                  transition: 'all 0.2s', cursor: 'default',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,160,96,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,160,96,0.1)')}
              >
                {/* Table icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'radial-gradient(ellipse, #1a5c35, #0a3020)',
                  border: '1px solid rgba(201,160,96,0.2)',
                  fontSize: 16,
                }}>
                  ♠
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#e8dcc8', fontSize: 14 }}>{table.name}</div>
                  <div style={{ fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: statusColor[table.status], fontWeight: 600 }}>● {statusLabel[table.status] ?? table.status}</span>
                    <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                    <span style={{ color: 'rgba(232,220,200,0.3)' }}>
                      {table.playerCount} player{table.playerCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => joinTable(table.id)}
                  disabled={table.status === 'playing'}
                  style={{
                    padding: '8px 20px', borderRadius: 8, cursor: table.status === 'playing' ? 'default' : 'pointer',
                    background: table.status === 'playing'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(201,160,96,0.1)',
                    border: table.status === 'playing'
                      ? '1px solid rgba(255,255,255,0.06)'
                      : '1px solid rgba(201,160,96,0.3)',
                    color: table.status === 'playing' ? 'rgba(255,255,255,0.2)' : '#e8c97a',
                    fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (table.status !== 'playing') {
                      e.currentTarget.style.background = 'rgba(201,160,96,0.18)';
                      e.currentTarget.style.boxShadow = '0 0 16px rgba(201,160,96,0.2)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = table.status === 'playing' ? 'rgba(255,255,255,0.04)' : 'rgba(201,160,96,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {table.status === 'playing' ? 'In Progress' : 'Join →'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
