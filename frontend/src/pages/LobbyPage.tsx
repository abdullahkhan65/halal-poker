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
    socket.emit('get_tables', {}, (data: TableInfo[]) => setTables(data ?? []));
    socket.on('tables_updated', setTables);
    return () => { socket.off('tables_updated', setTables); };
  }, []);

  function createTable() {
    if (!tableName.trim()) return;
    const socket = connectSocket();
    socket.emit('create_table', { name: tableName }, (table: { id: string }) => {
      setTableId(table.id);
      nav(`/table/${table.id}`);
    });
  }

  function joinTable(tableId: string) {
    setTableId(tableId);
    nav(`/table/${tableId}`);
  }

  const statusColor: Record<string, string> = {
    waiting: 'text-green-400',
    playing: 'text-yellow-400',
    finished: 'text-gray-500',
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-yellow-400 mb-1">Game Lobby</h2>
        <p className="text-gray-400 text-sm">Welcome back, {user?.name} 👋</p>
      </div>

      <div className="p-5 rounded-xl bg-gray-900 border border-gray-800">
        <h3 className="font-semibold text-white mb-3">Create Table</h3>
        <div className="flex gap-3">
          <input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTable()}
            placeholder="Table name"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
          <button
            onClick={createTable}
            className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition"
          >
            Create
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-white mb-3">Open Tables</h3>
        {tables.length === 0 ? (
          <div className="text-center py-12 text-gray-600 border border-dashed border-gray-800 rounded-xl">
            No tables yet. Create one above!
          </div>
        ) : (
          <div className="space-y-3">
            {tables.map((table, i) => (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 transition"
              >
                <div className="flex-1">
                  <div className="font-semibold text-white">{table.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <span className={statusColor[table.status]}>{table.status}</span>
                    <span className="mx-1 text-gray-700">·</span>
                    {table.playerCount} player{table.playerCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => joinTable(table.id)}
                  disabled={table.status === 'playing'}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition disabled:opacity-40"
                >
                  {table.status === 'playing' ? 'In Progress' : 'Join'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
