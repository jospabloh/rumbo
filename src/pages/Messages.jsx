import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Mic, MicOff, Plus, Hash, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NewChannelForm from '@/components/messages/NewChannelForm';

export default function Messages() {
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const messagesEndRef = useRef(null);
  const lastSeenRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      base44.entities.Channel.list().then(c => {
        setChannels(c);
        if (c.length > 0) setSelectedChannel(c[0]);
      }).finally(() => setLoading(false));
    });
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    loadMessages();
    // Subscribe to real-time updates
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.data?.channel_id === selectedChannel.id) {
        if (event.type === 'create') {
          setMessages(prev => {
            if (prev.some(m => m.id === event.id)) return prev;
            return [...prev, event.data];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      }
    });
    return unsubscribe;
  }, [selectedChannel?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedChannel) return;
    const msgs = await base44.entities.Message.filter({ channel_id: selectedChannel.id }, '-created_date', 100);
    const sorted = msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setMessages(sorted);
    // Mark as delivered/read
    const unread = sorted.filter(m => !m.read && m.sender_id !== user?.id);
    for (const m of unread) {
      base44.entities.Message.update(m.id, { delivered: true, read: true }).catch(() => {});
    }
    if (sorted.length > 0) lastSeenRef.current = sorted[sorted.length - 1].created_date;
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !selectedChannel || !user) return;
    setSending(true);
    await base44.entities.Message.create({
      channel_id: selectedChannel.id,
      sender_id: user.id,
      sender_name: user.full_name,
      body: newMessage.trim(),
      delivered: false,
      read: false,
    });
    setNewMessage('');
    setSending(false);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks = [];
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Message.create({
        channel_id: selectedChannel.id,
        sender_id: user.id,
        sender_name: user.full_name,
        body: null,
        audio_url: file_url,
        delivered: false,
        read: false,
      });
    };
    mr.start();
    setMediaRecorder(mr);
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
    setMediaRecorder(null);
  };

  const handleCreateChannel = async (data) => {
    const ch = await base44.entities.Channel.create(data);
    setChannels(c => [...c, ch]);
    setSelectedChannel(ch);
    setShowNewChannel(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex h-full">
      {/* Channel list */}
      <div className="w-56 lg:w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Canales</span>
          <button onClick={() => setShowNewChannel(true)} className="text-primary hover:opacity-80"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {channels.map(ch => (
            <button key={ch.id} onClick={() => setSelectedChannel(ch)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${selectedChannel?.id === ch.id ? 'bg-sidebar-accent text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'}`}>
              {ch.kind === 'broadcast' ? <Hash className="w-3.5 h-3.5 shrink-0" /> : <User className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{ch.name || 'Sin nombre'}</span>
            </button>
          ))}
          {channels.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">Sin canales</p>}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChannel ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              {selectedChannel.kind === 'broadcast' ? <Hash className="w-4 h-4 text-muted-foreground" /> : <User className="w-4 h-4 text-muted-foreground" />}
              <span className="font-semibold text-sm">{selectedChannel.name || 'Canal'}</span>
              <span className="text-xs text-muted-foreground capitalize">· {selectedChannel.kind === 'broadcast' ? 'Broadcast' : 'Directo'}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isOwn ? 'order-2' : ''}`}>
                      {!isOwn && <p className="text-xs text-muted-foreground mb-1">{msg.sender_name || 'Conductor'}</p>}
                      <div className={`rounded-2xl px-3 py-2 ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
                        {msg.body && <p className="text-sm">{msg.body}</p>}
                        {msg.audio_url && (
                          <audio controls className="max-w-full" style={{ height: 36 }}>
                            <source src={msg.audio_url} type="audio/webm" />
                          </audio>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 px-1">
                        {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isOwn && (msg.read ? ' · Leído' : msg.delivered ? ' · Entregado' : ' · Enviado')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
              {messages.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Sin mensajes aún</p>}
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2">
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="bg-background flex-1"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
              />
              <Button type="button" size="icon" variant="outline"
                onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                className={recording ? 'bg-destructive text-white border-destructive' : ''}>
                {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Selecciona un canal</p>
          </div>
        )}
      </div>

      {showNewChannel && (
        <NewChannelForm onSave={handleCreateChannel} onClose={() => setShowNewChannel(false)} />
      )}
    </div>
  );
}