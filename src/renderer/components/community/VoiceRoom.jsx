import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { FaMicrophone, FaMicrophoneSlash, FaHeadphones, FaHeadphonesAlt, FaPhoneSlash, FaSignal, FaCog, FaBug } from 'react-icons/fa';

const VoiceRoom = ({ channel, user, onLeave }) => {
    const [participants, setParticipants] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [volume, setVolume] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [inputDevices, setInputDevices] = useState([]);
    const [selectedInputId, setSelectedInputId] = useState('');
    const [outputDevices, setOutputDevices] = useState([]);
    const [selectedOutputId, setSelectedOutputId] = useState('');
    const [debugMode, setDebugMode] = useState(false);
    const [connectionStates, setConnectionStates] = useState({});

    // Refs for WebRTC state (avoiding stale closures)
    const mediaStreamRef = useRef(null);
    const peerConnectionsRef = useRef(new Map()); // Map<userId, RTCPeerConnection>
    const iceCandidateQueueRef = useRef(new Map()); // Map<userId, RTCIceCandidate[]>
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const channelRef = useRef(channel); // Keep latest channel
    const userRef = useRef(user); // Keep latest user

    // Keep refs updated
    useEffect(() => { channelRef.current = channel; }, [channel]);
    useEffect(() => { userRef.current = user; }, [user]);

    // Initialize Devices and Audio
    useEffect(() => {
        getDevices();
        startAudio();

        return () => {
            stopAudio();
            cleanupWebRTC();
        };
    }, []);

    // Re-start audio if input device changes
    useEffect(() => {
        if (selectedInputId) {
            startAudio();
        }
    }, [selectedInputId]);

    // Update output device for all audio elements
    useEffect(() => {
        if (selectedOutputId) {
            document.querySelectorAll('audio[id^="audio-"]').forEach(async (el) => {
                if (el.setSinkId) {
                    try { await el.setSinkId(selectedOutputId); }
                    catch (e) { console.error("Error setting sinkId", e); }
                }
            });
        }
    }, [selectedOutputId]);

    const [isSignalingReady, setIsSignalingReady] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);
    const addLog = (msg) => setDebugLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAudio();
            cleanupWebRTC();
            leaveChannelDB();
        };
    }, []);

    // 1. Initialize Signaling (Broadcast) - First Step
    useEffect(() => {
        if (!channel?.id) return;

        console.log("Initializing signaling...");
        const signalingChannel = supabase.channel(`room:${channel.id}`);

        signalingChannel
            .on('broadcast', { event: 'signal' }, (payload) => {
                handleSignal(payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("Subscribed to signaling channel");
                    addLog("Signaling Connected. Joining Room...");
                    setIsSignalingReady(true);
                }
            });

        return () => {
            console.log("Leaving signaling channel");
            supabase.removeChannel(signalingChannel);
            setIsSignalingReady(false);
        };
    }, [channel?.id]);

    // 2. Join DB and Listen for Participants - Only after Signaling is Ready
    useEffect(() => {
        if (!isSignalingReady || !user) return;

        joinChannelDB();
        fetchParticipants();

        const dbSubscription = supabase
            .channel(`public:voice_participants:channel_id=eq.${channel.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_participants', filter: `channel_id=eq.${channel.id}` }, (payload) => {
                const newParticipant = payload.new;
                const oldParticipant = payload.old;

                if (payload.eventType === 'INSERT') {
                    if (newParticipant.user_id !== user.id) {
                        addLog(`User joined: ${newParticipant.user_id.slice(0, 4)}`);
                        // Give a small delay to ensure they are ready? 
                        // With the new logic, they should be ready because they joined DB *after* signaling.
                        // But let's add a small organic delay just to be safe from their side processing.
                        setTimeout(() => createPeerConnection(newParticipant.user_id, true), 500);
                    }
                    fetchParticipants();
                } else if (payload.eventType === 'DELETE') {
                    addLog(`User left: ${oldParticipant.user_id.slice(0, 4)}`);
                    closePeerConnection(oldParticipant.user_id);
                    fetchParticipants();
                } else if (payload.eventType === 'UPDATE') {
                    fetchParticipants();
                }
            })
            .subscribe();

        return () => {
            leaveChannelDB();
            supabase.removeChannel(dbSubscription);
        };
    }, [isSignalingReady, user, channel?.id]);


    // --- Audio Handling ---

    const getDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter(d => d.kind === 'audioinput');
            const outputs = devices.filter(d => d.kind === 'audiooutput');

            setInputDevices(inputs);
            setOutputDevices(outputs);

            // Load from localStorage or default
            const savedInput = localStorage.getItem('audioInputId');
            const savedOutput = localStorage.getItem('audioOutputId');

            if (savedInput && inputs.find(d => d.deviceId === savedInput)) {
                setSelectedInputId(savedInput);
            } else if (inputs.length > 0) {
                setSelectedInputId('default');
            }

            if (savedOutput && outputs.find(d => d.deviceId === savedOutput)) {
                setSelectedOutputId(savedOutput);
            } else if (outputs.length > 0) {
                setSelectedOutputId('default');
            }

        } catch (e) {
            console.error("Error enumerating devices", e);
        }
    }

    const startAudio = async () => {
        try {
            // Stop existing tracks
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputId ? { exact: selectedInputId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            mediaStreamRef.current = stream;

            // Re-attach local stream to all existing peer connections (if any)
            peerConnectionsRef.current.forEach((pc) => {
                const senders = pc.getSenders();
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) {
                    audioSender.replaceTrack(stream.getAudioTracks()[0]);
                } else {
                    pc.addTrack(stream.getAudioTracks()[0], stream);
                }
            });

            // Audio Analysis
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            audioContextRef.current = audioCtx;

            analyzeVolume();

        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };

    const stopAudio = () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };

    const analyzeVolume = () => {
        if (!analyserRef.current) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const update = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const average = sum / bufferLength;
            setVolume(Math.min(average * 2, 100));
            animationRef.current = requestAnimationFrame(update);
        };
        update();
    };


    // --- WebRTC Logic ---

    const ICE_SERVERS = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    const createPeerConnection = async (targetUserId, isInitiator) => {
        if (peerConnectionsRef.current.has(targetUserId)) {
            return peerConnectionsRef.current.get(targetUserId);
        }

        addLog(`${isInitiator ? 'Initiating' : 'Accepting'} conn: ${targetUserId.slice(0, 4)}`);
        console.log(`Creating peer connection to ${targetUserId}. Initiator: ${isInitiator}`);
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionsRef.current.set(targetUserId, pc);

        // Init queue for this peer
        iceCandidateQueueRef.current.set(targetUserId, []);

        // Add local stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, mediaStreamRef.current);
            });
        }

        // Connection State Monitoring
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`Connection state with ${targetUserId}: ${state}`);
            addLog(`State (${targetUserId.slice(0, 4)}): ${state}`);
            setConnectionStates(prev => ({
                ...prev,
                [targetUserId]: state
            }));
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'candidate',
                    target: targetUserId,
                    payload: event.candidate
                });
            }
        };

        // Handle Negotiation Needed (Renegotiation)
        pc.onnegotiationneeded = async () => {
            console.log(`Negotiation needed with ${targetUserId}. SignalingState: ${pc.signalingState}`);
            try {
                // Prevent Callee from sending initial offer and colliding with Initiator
                if (!isInitiator && !pc.currentRemoteDescription) {
                    console.log("Ignoring negotiationneeded as Callee waiting for initial offer");
                    return;
                }

                // If we are unstable, we might be in the middle of negotiation.
                // Standard check: if (pc.signalingState != "stable") return; 
                // But sometimes we need to queue? For now, nice and simple:
                if (pc.signalingState !== 'stable') {
                    console.log("Signaling state not stable, skipping negotiation request");
                    return;
                }

                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal({
                    type: 'offer',
                    target: targetUserId,
                    payload: offer
                });
            } catch (e) {
                console.error("Error handling negotiation needed", e);
            }
        };

        // Handle Remote Stream
        pc.ontrack = (event) => {
            console.log(`Received remote track from ${targetUserId}`);
            const remoteStream = event.streams[0];

            // Create audio element
            let audioElement = document.getElementById(`audio-${targetUserId}`);
            if (!audioElement) {
                audioElement = document.createElement('audio');
                audioElement.id = `audio-${targetUserId}`;
                audioElement.autoplay = true;
                audioElement.controls = true; // Debug: Show controls
                audioElement.style.display = 'none'; // Keep hidden but controls=true helps logic sometimes
                document.body.appendChild(audioElement);
            }
            audioElement.srcObject = remoteStream;

            // Apply output device
            if (audioElement.setSinkId && selectedOutputId) {
                audioElement.setSinkId(selectedOutputId).catch(console.error);
            }

            // Ensure playing
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.error("Auto-play failed", e);
                    // interact to play?
                });
            }
        };



        if (isInitiator) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal({
                    type: 'offer',
                    target: targetUserId,
                    payload: offer
                });
            } catch (e) {
                console.error("Error creating offer", e);
            }
        }

        return pc;
    };

    const handleSignal = async ({ payload: signalData }) => {
        // IMPORTANT: Use userRef to ensure we have the current user ID
        if (signalData.target !== userRef.current.id) return; // Not for me

        const senderId = signalData.sender;
        const { type, payload } = signalData;

        console.log(`Received signal ${type} from ${senderId}`);

        let pc = peerConnectionsRef.current.get(senderId);

        if (!pc) {
            // Incoming offer (we are receiver)
            if (type === 'offer') {
                pc = await createPeerConnection(senderId, false);
            } else {
                console.warn("Received signal for non-existent peer connection", type, senderId);
                return;
            }
        }

        try {
            if (type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload));

                // Process queued candidates
                const queue = iceCandidateQueueRef.current.get(senderId) || [];
                while (queue.length > 0) {
                    const candidate = queue.shift();
                    await pc.addIceCandidate(candidate);
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({
                    type: 'answer',
                    target: senderId,
                    payload: answer
                });
            } else if (type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                // Process queued candidates
                const queue = iceCandidateQueueRef.current.get(senderId) || [];
                while (queue.length > 0) {
                    const candidate = queue.shift();
                    await pc.addIceCandidate(candidate);
                }
            } else if (type === 'candidate') {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(payload));
                } else {
                    // Queue it
                    const queue = iceCandidateQueueRef.current.get(senderId) || [];
                    queue.push(new RTCIceCandidate(payload));
                    iceCandidateQueueRef.current.set(senderId, queue);
                }
            }
        } catch (e) {
            console.error(`Error handling signal ${type}`, e);
        }
    };

    const sendSignal = async (data) => {
        // data: { type, target, payload }
        // Add sender ID from userRef
        const message = { ...data, sender: userRef.current.id };
        await supabase.channel(`room:${channelRef.current.id}`).send({
            type: 'broadcast',
            event: 'signal',
            payload: message
        });
    };

    const closePeerConnection = (userId) => {
        const pc = peerConnectionsRef.current.get(userId);
        if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(userId);
        }
        const audioElement = document.getElementById(`audio-${userId}`);
        if (audioElement) audioElement.remove();

        setConnectionStates(prev => {
            const newState = { ...prev };
            delete newState[userId];
            return newState;
        });
    };

    const cleanupWebRTC = () => {
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        // Remove all audio elements
        document.querySelectorAll('audio[id^="audio-"]').forEach(el => el.remove());
    };


    // --- DB Wrappers ---

    const joinChannelDB = async () => {
        try {
            await supabase.from('voice_participants').upsert({
                channel_id: channel.id,
                user_id: user.id,
                muted: isMuted,
                deafened: isDeafened,
                joined_at: new Date()
            });
        } catch (error) { console.error(error); }
    };

    const leaveChannelDB = async () => {
        try {
            await supabase.from('voice_participants').delete().eq('channel_id', channel.id).eq('user_id', user.id);
        } catch (error) { console.error(error); }
    };

    const fetchParticipants = async () => {
        const { data } = await supabase.from('voice_participants').select('*, profiles(username, avatar_url)').eq('channel_id', channel.id);
        setParticipants(data || []);
    };

    const toggleMute = async () => {
        const newState = !isMuted;
        setIsMuted(newState);
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getAudioTracks().forEach(track => track.enabled = !newState);
        }
        await supabase.from('voice_participants').update({ muted: newState }).eq('channel_id', channel.id).eq('user_id', user.id);
    };

    const toggleDeafen = async () => {
        const newState = !isDeafened;
        setIsDeafened(newState);
        // Logic to silence remote audio?
        // Loop through audio elements and un/mute them
        document.querySelectorAll('audio[id^="audio-"]').forEach(el => el.muted = newState);

        await supabase.from('voice_participants').update({ deafened: newState }).eq('channel_id', channel.id).eq('user_id', user.id);
    };

    // UI Render
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-[#18191c] border-t border-gray-800 p-3 shadow-2xl flex items-center justify-between z-40 animate-slide-up">
            <div className="flex items-center gap-4">
                <div className="text-green-500 font-bold flex items-center gap-2">
                    <FaSignal />
                    <span>Conectado: {channel.name}</span>
                </div>
                <div className="h-8 w-[1px] bg-gray-700 mx-2"></div>
                <div className="flex -space-x-2">
                    {participants.map(p => {
                        const isMe = p.user_id === user.id;
                        const isTalking = isMe ? volume > 10 : false;
                        const status = connectionStates[p.user_id];
                        const statusColor = status === 'connected' ? 'bg-green-500' : (status === 'failed' ? 'bg-red-500' : (status ? 'bg-yellow-500' : ''));

                        return (
                            <div key={p.user_id} className="relative group">
                                <div className={`w-8 h-8 rounded-full border-2 transition-all duration-100 overflow-hidden ${p.muted ? 'opacity-50 border-gray-600' : (isTalking ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] scale-110' : 'border-[#18191c]')}`}>
                                    {p.profiles?.avatar_url ? (
                                        <img src={p.profiles.avatar_url} alt={p.profiles.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white">
                                            {p.profiles?.username?.[0]}
                                        </div>
                                    )}
                                </div>
                                {/* Status Dot */}
                                {!isMe && status && (
                                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#18191c] ${statusColor}`} title={`Status: ${status}`}></div>
                                )}

                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50">
                                    {p.profiles?.username} {p.muted && '(Mutado)'} {status && `[${status}]`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Input Device Selector Modal */}
            {showSettings && (
                <div className="absolute bottom-16 right-4 bg-[#1e2029] border border-gray-700 p-4 rounded-lg shadow-xl w-64 animate-fade-in z-50">
                    <h4 className="text-white font-bold mb-2 flex items-center gap-2"><FaCog /> Configurações de Voz</h4>
                    <div className="space-y-2">
                        <label className="text-xs text-gray-400">Dispositivo de Entrada</label>
                        <select
                            className="w-full bg-black/30 text-white text-xs p-2 rounded border border-gray-600 outline-none"
                            value={selectedInputId}
                            onChange={(e) => {
                                setSelectedInputId(e.target.value);
                                localStorage.setItem('audioInputId', e.target.value);
                            }}
                        >
                            {inputDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Microfone ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                        </select>

                        <div className="mt-4 border-t border-gray-600 pt-2">
                            <label className="text-xs text-gray-400">Dispositivo de Saída</label>
                            <select
                                className="w-full bg-black/30 text-white text-xs p-2 rounded border border-gray-600 outline-none"
                                value={selectedOutputId}
                                onChange={(e) => {
                                    setSelectedOutputId(e.target.value);
                                    localStorage.setItem('audioOutputId', e.target.value);
                                }}
                            >
                                {outputDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Alto-falante ${device.deviceId.slice(0, 5)}...`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-4 border-t border-gray-600 pt-2">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Teste de Microfone</span>
                                <span>{Math.round(volume)}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-100"
                                    style={{ width: `${Math.min(volume, 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Debug Toggle */}
                        <div className="mt-4 pt-2 border-t border-gray-600 flex items-center gap-2">
                            <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} id="debug-mode" />
                            <label htmlFor="debug-mode" className="text-xs text-gray-400">Modo Debug (Loopback + Logs)</label>
                        </div>

                        <div className="mt-2 text-center">
                            <button
                                onClick={() => {
                                    cleanupWebRTC();
                                    setConnectionStates({});
                                    fetchParticipants().then(() => {
                                        participants.forEach(p => {
                                            if (p.user_id !== user.id) createPeerConnection(p.user_id, true);
                                        });
                                    });
                                    addLog("Manual Reconnect Triggered");
                                }}
                                className="text-[10px] text-red-400 hover:text-red-300 underline"
                            >
                                Forçar Reconexão
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-3 rounded-full transition-colors ${showSettings ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    title="Configurações"
                >
                    <FaCog />
                </button>
                <button
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    title={isMuted ? "Desmutar" : "Mutar"}
                >
                    {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </button>
                <button
                    onClick={toggleDeafen}
                    className={`p-3 rounded-full transition-colors ${isDeafened ? 'bg-red-500/20 text-red-500' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    title={isDeafened ? "Ativar Áudio" : "Desativar Áudio"}
                >
                    {isDeafened ? <FaHeadphonesAlt /> : <FaHeadphones />}
                </button>
                <button
                    onClick={onLeave}
                    className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors shadow-lg shadow-red-500/20"
                    title="Desconectar"
                >
                    <FaPhoneSlash />
                </button>
            </div>

            {/* Hidden Audio Elements container for visual debug */}
            <div id="audio-container" className="hidden"></div>

            {/* Debug Overlay */}
            {debugMode && (
                <div className="fixed top-20 right-4 w-64 bg-black/80 p-2 text-[10px] font-mono text-green-400 rounded border border-green-500/30 z-[60] pointer-events-none">
                    <div className="font-bold border-b border-white/20 mb-1">Debug Log</div>
                    {debugLogs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            )}
            {/* Force Reconnect Button (Only visible if issues or debug?) Let's add it to settings for now or main bar */}
        </div>
    );
};

export default VoiceRoom;
