import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

export interface VoicePeer {
  userId: string;
  userName: string;
  speaking: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVoiceChat(socket: Socket | null, tableId: string | null, myUserId: string | null) {
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [muted, setMuted] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localStream = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());

  const createPeerConnection = useCallback((userId: string, userName: string) => {
    if (peerConnections.current.has(userId)) return peerConnections.current.get(userId)!;

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // attach local tracks
    localStream.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.current!);
    });

    // play remote audio
    pc.ontrack = (event) => {
      let el = audioElements.current.get(userId);
      if (!el) {
        el = new Audio();
        el.autoplay = true;
        audioElements.current.set(userId, el);
      }
      el.srcObject = event.streams[0];
    };

    // relay ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && tableId) {
        socket.emit('voice_ice', { tableId, targetId: userId, candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removePeer(userId);
      }
    };

    peerConnections.current.set(userId, pc);
    setPeers((prev) =>
      prev.find((p) => p.userId === userId)
        ? prev
        : [...prev, { userId, userName, speaking: false }],
    );

    return pc;
  }, [socket, tableId]);

  const removePeer = useCallback((userId: string) => {
    peerConnections.current.get(userId)?.close();
    peerConnections.current.delete(userId);
    audioElements.current.get(userId)?.remove();
    audioElements.current.delete(userId);
    setPeers((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  const join = useCallback(async () => {
    if (!socket || !tableId || !myUserId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;
      setActive(true);
      setError(null);
      socket.emit('voice_join', { tableId });
    } catch (e: any) {
      setError(e.message ?? 'Microphone access denied');
    }
  }, [socket, tableId, myUserId]);

  const leave = useCallback(() => {
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    audioElements.current.forEach((el) => el.remove());
    audioElements.current.clear();
    setPeers([]);
    setActive(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    const track = localStream.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }, []);

  // WebRTC signaling handlers
  useEffect(() => {
    if (!socket || !active) return;

    async function onPeerJoined({ userId, userName }: { userId: string; userName: string }) {
      if (userId === myUserId) return;
      const pc = createPeerConnection(userId, userName);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket!.emit('voice_offer', { tableId, targetId: userId, offer });
    }

    async function onOffer({ fromId, fromName, offer }: { fromId: string; fromName: string; offer: RTCSessionDescriptionInit }) {
      if (fromId === myUserId) return;
      const pc = createPeerConnection(fromId, fromName);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket!.emit('voice_answer', { tableId, targetId: fromId, answer });
    }

    async function onAnswer({ fromId, answer }: { fromId: string; answer: RTCSessionDescriptionInit }) {
      const pc = peerConnections.current.get(fromId);
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    }

    async function onIce({ fromId, candidate }: { fromId: string; candidate: RTCIceCandidateInit }) {
      const pc = peerConnections.current.get(fromId);
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    }

    function onPeerLeft({ userId }: { userId: string }) {
      removePeer(userId);
    }

    socket.on('voice_peer_joined', onPeerJoined);
    socket.on('voice_offer', onOffer);
    socket.on('voice_answer', onAnswer);
    socket.on('voice_ice', onIce);
    socket.on('voice_peer_left', onPeerLeft);

    return () => {
      socket.off('voice_peer_joined', onPeerJoined);
      socket.off('voice_offer', onOffer);
      socket.off('voice_answer', onAnswer);
      socket.off('voice_ice', onIce);
      socket.off('voice_peer_left', onPeerLeft);
    };
  }, [socket, active, myUserId, tableId, createPeerConnection, removePeer]);

  // cleanup on unmount
  useEffect(() => () => leave(), [leave]);

  return { peers, muted, active, error, join, leave, toggleMute };
}
