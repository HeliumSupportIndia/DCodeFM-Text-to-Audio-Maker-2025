import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceOption, VoiceType } from './types';
import { AVAILABLE_VOICES } from './constants';
import { generateSpeech } from './services/geminiService';
import { decodeBase64, decodePcmToAudioBuffer, createWavBlob, audioContext } from './utils/audioUtils';
import { PlayIcon, PauseIcon, DownloadIcon, SparklesIcon, LoadingSpinner } from './components/icons';

const App: React.FC = () => {
    const [text, setText] = useState<string>('हैलो (Hello) दुनिया! ये जो आप टेक्स्ट टू ऑडियो इस्तेमाल कर रहे हैं ना, इसे DCode FM ने बनाया है। अगर आप हमें सपोर्ट करना चाहते हैं, तो डोनेशन कर सकते हैं। डोनेशन के लिए आप हमें टेलीग्राम पर मैसेज (यानी DM) कर सकते हैं, हमारा हैंडल है @uloverks');
    const [selectedVoice, setSelectedVoice] = useState<string>(AVAILABLE_VOICES[0].voiceName);
    const [isLoading, setIsLoading] = useState<false | string>(false);
    const [error, setError] = useState<string | null>(null);
    const [audioData, setAudioData] = useState<{ raw: Uint8Array; buffer: AudioBuffer } | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [duration, setDuration] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState<number>(0);

    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const playbackStartTimeRef = useRef<number>(0);

    const stopPlayback = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (sourceNodeRef.current) {
            sourceNodeRef.current.onended = null; // Prevent onended from firing on manual stop
            sourceNodeRef.current.stop();
            sourceNodeRef.current = null;
        }
        setIsPlaying(false);
    }, []);
    
    useEffect(() => {
        return () => {
            stopPlayback();
        };
    }, [stopPlayback]);

    const handleGenerate = async () => {
        if (!text.trim()) {
            setError("Please enter some text to generate audio.");
            return;
        }
        stopPlayback();
        setIsLoading("Generating audio...");
        setError(null);
        setAudioData(null);
        setCurrentTime(0);
        setDuration(0);

        try {
            const base64Audio = await generateSpeech(text, selectedVoice);
            setIsLoading("Decoding audio...");
            const raw = decodeBase64(base64Audio);
            const buffer = await decodePcmToAudioBuffer(raw);
            setAudioData({ raw, buffer });
            setDuration(buffer.duration);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const startProgressLoop = useCallback(() => {
        const loop = () => {
            if (audioContext.state === 'running' && sourceNodeRef.current) {
                const elapsed = audioContext.currentTime - playbackStartTimeRef.current;
                setCurrentTime(Math.min(elapsed, duration));
            }
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        animationFrameRef.current = requestAnimationFrame(loop);
    }, [duration]);

    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            stopPlayback();
        } else if (audioData) {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            const source = audioContext.createBufferSource();
            source.buffer = audioData.buffer;
            source.connect(audioContext.destination);
            
            source.onended = () => {
                setIsPlaying(false);
                setCurrentTime(duration);
                 if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
                sourceNodeRef.current = null;
            };

            const offset = currentTime >= duration ? 0 : currentTime;
            if (offset >= duration) setCurrentTime(0);

            source.start(0, offset);
            
            playbackStartTimeRef.current = audioContext.currentTime - offset;
            sourceNodeRef.current = source;
            setIsPlaying(true);
            startProgressLoop();
        }
    }, [isPlaying, audioData, stopPlayback, currentTime, duration, startProgressLoop]);

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioData || !duration) return;
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newTime = (x / rect.width) * duration;
        const newCurrentTime = Math.max(0, Math.min(newTime, duration));
        
        setCurrentTime(newCurrentTime);

        if (isPlaying) {
            stopPlayback();
            // Automatically restart playback from the new position
            const source = audioContext.createBufferSource();
            source.buffer = audioData.buffer;
            source.connect(audioContext.destination);
            source.onended = () => {
                setIsPlaying(false);
                setCurrentTime(duration);
                 if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
                sourceNodeRef.current = null;
            };
            source.start(0, newCurrentTime);
            playbackStartTimeRef.current = audioContext.currentTime - newCurrentTime;
            sourceNodeRef.current = source;
            setIsPlaying(true);
            startProgressLoop();
        }
    };

    const handleDownload = () => {
        if (audioData) {
            const blob = createWavBlob(audioData.raw);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dcodefm_audio_2025.wav';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || time === 0) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-2xl mx-auto bg-slate-800/50 rounded-2xl shadow-2xl backdrop-blur-sm border border-slate-700">
                <div className="p-6 md:p-8">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
                           DCodeFM 🎙️ | Text to Audio 2025
                        </h1>
                        <p className="text-slate-400 mt-2">Made by DCodeFM © 2025</p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label htmlFor="text-input" className="block text-sm font-medium text-slate-300 mb-2">
                                Enter Text
                            </label>
                            <textarea
                                id="text-input"
                                rows={6}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Enter your text here..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Select Voice Model</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {AVAILABLE_VOICES.map((voice: VoiceOption, index: number) => (
                                    <button
                                        key={voice.id}
                                        onClick={() => setSelectedVoice(voice.voiceName)}
                                        className={`p-4 rounded-lg text-center font-semibold border-2 transition-all duration-300 flex flex-col items-center justify-center space-y-2
                                            ${selectedVoice === voice.voiceName ? 'bg-purple-600 border-purple-500 shadow-lg shadow-purple-600/20' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}
                                    >
                                        <span>{voice.type === VoiceType.Male ? '👨' : '👩'}</span>
                                        <span>{`Voice Model ${index + 1}`}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2">
                             <button
                                onClick={handleGenerate}
                                disabled={!!isLoading}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                            >
                                {isLoading ? (
                                    <>
                                        <LoadingSpinner className="w-5 h-5" />
                                        <span>{isLoading}</span>
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-5 h-5" />
                                        <span>Generate Audio</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center">
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {audioData && (
                    <div className="bg-slate-900/50 p-4 md:p-6 border-t border-slate-700 rounded-b-2xl">
                         <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-grow">
                                <button
                                    onClick={handlePlayPause}
                                    aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                                    className="flex items-center justify-center p-3 bg-cyan-600 text-white rounded-full hover:bg-cyan-700 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                                >
                                    {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                                </button>
                                <div className="flex items-center gap-2 flex-grow">
                                    <span className="text-sm font-mono text-slate-400 w-12 text-right">{formatTime(currentTime)}</span>
                                    <div
                                        className="w-full bg-slate-700 rounded-full h-2 cursor-pointer group"
                                        onClick={handleSeek}
                                        role="progressbar"
                                        aria-valuenow={currentTime}
                                        aria-valuemin={0}
                                        aria-valuemax={duration}
                                        aria-label="Audio progress"
                                    >
                                        <div 
                                            className="bg-cyan-400 h-2 rounded-full group-hover:bg-cyan-300 transition-all" 
                                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-sm font-mono text-slate-400 w-12">{formatTime(duration)}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleDownload}
                                className="flex items-center justify-center gap-2 bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 transform hover:scale-105"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                <span>Download</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
