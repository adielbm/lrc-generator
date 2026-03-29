import Head from 'next/head';
import { useState, useRef, useEffect } from 'react';
import { Upload, Link as LinkIcon, Download, Play, Pause, X } from 'lucide-react';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function isYouTubeUrl(url) {
  return extractYouTubeId(url) !== null;
}

export default function Home() {
  const [audioUrl, setAudioUrl] = useState('');
  const [ytInput, setYtInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [metadata, setMetadata] = useState({ title: '', artist: '', album: '', by: '', comments: '' });
  const [formatMode, setFormatMode] = useState('A1'); // 'A1' or 'A2'
  
  const [rawText, setRawText] = useState('');
  const [lines, setLines] = useState([]);
  const [activeIndex, setActiveIndex] = useState({ line: 0, word: 0 });
  const [lineTagHistory, setLineTagHistory] = useState([]);
  const [wordTagHistory, setWordTagHistory] = useState([]);
  const [showEditMode, setShowEditMode] = useState(true); // True = show textarea, False = show edit button
  const [mobilePanelType, setMobilePanelType] = useState(null); // 'tags' | 'lyrics' | null

  const playerRef = useRef(null);
  const scrollRef = useRef(null);
  const isYouTube = isYouTubeUrl(audioUrl);
  const ytPlayerRef = useRef(null);

  const destroyYouTubePlayer = () => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
      try {
        ytPlayerRef.current.destroy();
      } catch (e) {
        // Ignore intermittent teardown errors from the YouTube iframe API.
      }
    }
    ytPlayerRef.current = null;

    const playerContainer = document.getElementById('yt-player');
    if (playerContainer) {
      playerContainer.innerHTML = '';
    }
  };

  const canCallYouTube = (method) => {
    return !!(ytPlayerRef.current && typeof ytPlayerRef.current[method] === 'function');
  };

  const getYouTubeCurrentTime = () => {
    return canCallYouTube('getCurrentTime') ? ytPlayerRef.current.getCurrentTime() : 0;
  };

  const seekYouTube = (time) => {
    if (canCallYouTube('seekTo')) {
      ytPlayerRef.current.seekTo(Math.max(0, time), true);
    }
  };

  const playYouTube = () => {
    if (canCallYouTube('playVideo')) {
      ytPlayerRef.current.playVideo();
    }
  };

  const pauseYouTube = () => {
    if (canCallYouTube('pauseVideo')) {
      ytPlayerRef.current.pauseVideo();
    }
  };

  // YouTube API initialization
  useEffect(() => {
    if (!isYouTube) {
      destroyYouTubePlayer();
      return;
    }

    let isEffectActive = true;
    
    const loadYouTubeAPI = () => {
      if (!isEffectActive) return;

      if (window.YT && window.YT.Player) {
        initYouTubePlayer();
      } else {
        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          if (firstScriptTag && firstScriptTag.parentNode) {
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
          } else {
            document.head.appendChild(tag);
          }
        }
        
        window.onYouTubeIframeAPIReady = initYouTubePlayer;
      }
    };

    const initYouTubePlayer = () => {
      if (!isEffectActive) return;

      const videoId = extractYouTubeId(audioUrl);
      if (!videoId) return;

      const playerContainer = document.getElementById('yt-player');
      if (!playerContainer) return;

      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        ytPlayerRef.current.loadVideoById(videoId);
        setCurrentTime(0);
        return;
      }
      
      ytPlayerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: onPlayerStateChange,
        },
      });
    };

    const onPlayerStateChange = (event) => {
      if (event.data === window.YT.PlayerState.PLAYING) {
        setIsPlaying(true);
      } else if (event.data === window.YT.PlayerState.PAUSED) {
        setIsPlaying(false);
      }
    };

    loadYouTubeAPI();

    // Update YouTube time every 100ms
    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        setCurrentTime(ytPlayerRef.current.getCurrentTime());
        if (typeof ytPlayerRef.current.getDuration === 'function') {
          setDuration(ytPlayerRef.current.getDuration());
        }
      }
    }, 100);

    return () => {
      isEffectActive = false;
      clearInterval(interval);
      destroyYouTubePlayer();
    };
  }, [audioUrl, isYouTube]);

  useEffect(() => {
    // Process rawText when showEditMode changes from true to false (user clicks Load)
    if (!showEditMode && rawText.trim()) {
      const newLines = rawText.split('\n').filter(l => l.trim().length > 0).map(line => {
        const words = line.trim().split(/\s+/).map(w => ({ text: w, time: null }));
        return { text: line.trim(), time: null, words };
      });
      setLines(newLines);
      setActiveIndex({ line: 0, word: 0 });
      setLineTagHistory([]);
      setWordTagHistory([]);
    }
  }, [showEditMode, rawText]);



  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.repeat) return; // Prevent hold-down repeating triggers

      if (e.code === 'Space') {
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        handlePlayPause();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        tagCurrent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lines, activeIndex, formatMode, audioUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('.active-tag');
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [lineTagHistory, wordTagHistory, formatMode]);

  // Setup audio element event listeners - runs after audio is mounted
  useEffect(() => {
    const audio = playerRef.current;
    if (!audio || isYouTube) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate, { passive: true });
    audio.addEventListener('ended', handleEnded, { passive: true });
    audio.addEventListener('loadedmetadata', handleLoadedMetadata, { passive: true });

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioUrl, isYouTube]);

  // Sync isPlaying state with audio element
  useEffect(() => {
    const audio = playerRef.current;
    if (!audio || isYouTube) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, isYouTube]);

  // Sync playbackRate with audio element
  useEffect(() => {
    const audio = playerRef.current;
    if (audio && !isYouTube) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate, isYouTube]);

  // Sync YouTube player with isPlaying
  useEffect(() => {
    if (!isYouTube || !ytPlayerRef.current) return;
    if (isPlaying) {
      playYouTube();
    } else {
      pauseYouTube();
    }
  }, [isPlaying, isYouTube]);

  const tagCurrent = () => {
    if (lines.length === 0 || activeIndex.line >= lines.length) return;
    
    let time = 0;
    if (isYouTubeUrl(audioUrl) && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      time = ytPlayerRef.current.getCurrentTime();
    } else if (playerRef.current) {
      time = playerRef.current.currentTime;
    }
    
    // Deep clone line before mutation
    const newLines = lines.map(line => ({
      ...line,
      words: line.words ? line.words.map(w => ({...w})) : []
    }));
    const { line, word } = activeIndex;

    if (formatMode === 'A1') {
      newLines[line].time = time;
      setLines(newLines);
      setLineTagHistory(prev => [...prev, line]);
      setActiveIndex({ line: Math.min(line + 1, lines.length - 1), word: 0 });
    } else {
      newLines[line].words[word].time = time;
      if (word === 0) newLines[line].time = time;
      
      setLines(newLines);
      setWordTagHistory(prev => [...prev, { line, word }]);
      if (word + 1 < newLines[line].words.length) {
        setActiveIndex({ line, word: word + 1 });
      } else {
        setActiveIndex({ line: Math.min(line + 1, lines.length - 1), word: 0 });
      }
    }
  };

  const tagLineAtCurrentTime = (lineIndex) => {
    if (lines.length === 0 || lineIndex < 0 || lineIndex >= lines.length) return;

    let time = 0;
    if (isYouTubeUrl(audioUrl) && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      time = ytPlayerRef.current.getCurrentTime();
    } else if (playerRef.current) {
      time = playerRef.current.currentTime;
    }

    const newLines = lines.map(line => ({
      ...line,
      words: line.words ? line.words.map(w => ({ ...w })) : []
    }));

    newLines[lineIndex].time = time;
    setLines(newLines);
    setLineTagHistory(prev => [...prev, lineIndex]);
    setActiveIndex({ line: Math.min(lineIndex + 1, lines.length - 1), word: 0 });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioUrl(URL.createObjectURL(file));
      // Don't auto-play, let user click play
      if (!metadata.title) setMetadata(p => ({ ...p, title: file.name.split('.')[0] }));
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(p => !p);
  };

  const exportLrc = () => {
    let out = `[ti:${metadata.title}]\n[ar:${metadata.artist}]\n[al:${metadata.album}]\n`;
    out += `[by:${metadata.by}]\n`;
    out += `[re:adielbm.github.io/lrc-generator]\n`;
    out += `[ve:${process.env.NEXT_PUBLIC_APP_VERSION || 'dev'}]\n`;
    const exportDuration = isYouTube
      ? duration
      : (playerRef.current ? playerRef.current.duration || 0 : duration);
    const durStr = formatTime(exportDuration || 0);
    out += `[length:${durStr}]\n`;

    const commentLines = metadata.comments
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    commentLines.forEach(comment => {
      out += `#${comment}\n`;
    });

    lines.forEach(l => {
      if (l.time !== null) {
        if (formatMode === 'A1') {
          out += `[${formatTime(l.time)}]${l.text}\n`;
        } else {
          out += `[${formatTime(l.time)}]`;
          l.words.forEach(w => {
            if (w.time !== null) out += `<${formatTime(w.time)}>${w.text}`;
            else out += `${w.text}`;
            out += ' ';
          });
          out = out.trimEnd() + '\n';
        }
      }
    });

    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.title || 'lyrics'}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen font-sans text-gray-900 bg-white dark:text-gray-100 dark:bg-gray-900 transition-colors">
      <Head>
        <title>Minimal LRC Generator</title>
      </Head>

      {/* Header Bar */}
      <header className="flex-none px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row gap-3 md:gap-4 items-stretch lg:items-center justify-between">
        <div className="w-full lg:w-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-left">LRC Generator</h1>
          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobilePanelType('tags')}
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-sm"
            >
              Edit Tags
            </button>
            <button
              type="button"
              onClick={() => setMobilePanelType('lyrics')}
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-sm"
            >
              Add Lyrics
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:flex-1 lg:max-w-xl">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden w-full">
            <input 
              type="text" 
              placeholder="Audio URL (.mp3, .wav) or YouTube URL..." 
              className="bg-transparent px-4 py-2 w-full outline-none text-sm"
              value={ytInput}
              onChange={e => setYtInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setAudioUrl(ytInput)}
            />
            <button onClick={() => setAudioUrl(ytInput)} className="px-3 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              <LinkIcon size={16} />
            </button>
          </div>
          <span className="text-xs sm:text-sm font-medium opacity-50 text-center hidden sm:inline">or</span>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition whitespace-nowrap">
            <Upload size={16} /> Local File
            <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        <div className="w-full lg:w-auto flex flex-wrap items-center justify-center lg:justify-end gap-2">
           <button 
             className={`px-3 py-1.5 rounded-md text-sm font-medium border whitespace-nowrap ${formatMode === 'A1' ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-60'}`}
             onClick={() => setFormatMode('A1')}
           >
             Simple
             <small className="ml-1 px-1 text-gray-900 dark:text-gray-100 rounded">(by lines)</small>
           </button>
           <button 
             className={`px-3 py-1.5 rounded-md text-sm font-medium border whitespace-nowrap ${formatMode === 'A2' ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-60'}`}
             onClick={() => setFormatMode('A2')}
           >
             Enhanced (A2)
              <small className="ml-1 px-1 text-gray-900 dark:text-gray-100 rounded">(by words)</small>
           </button>
           <button onClick={exportLrc} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition whitespace-nowrap">
             <Download size={16} /> Export
           </button>
        </div>
      </header>

      {/* Main split view */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden overflow-y-auto">
        {mobilePanelType && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setMobilePanelType(null)}
          />
        )}

        {/* Left pane: metadata and raw text input */}
        <section
          className={`w-[88vw] max-w-sm md:max-w-none md:w-1/3 border-r md:border-b-0 border-gray-200 dark:border-gray-800 p-4 md:p-6 flex flex-col gap-4 overflow-y-auto bg-white dark:bg-gray-900 md:bg-transparent fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:static md:translate-x-0 ${mobilePanelType ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="md:hidden flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{mobilePanelType === 'lyrics' ? 'Add Lyrics' : 'Edit Tags'}</h2>
            <button
              type="button"
              onClick={() => setMobilePanelType(null)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-sm"
            >
              <X size={14} />
              Close
            </button>
          </div>

          <div className={`${mobilePanelType === 'lyrics' ? 'hidden md:block' : ''}`}>
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Song Info</h2>
            <div className="space-y-2 text-sm">
              <input className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="Title" value={metadata.title} onChange={e => setMetadata({...metadata, title: e.target.value})} />
              <input className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="Artist" value={metadata.artist} onChange={e => setMetadata({...metadata, artist: e.target.value})} />
              <input className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="Album" value={metadata.album} onChange={e => setMetadata({...metadata, album: e.target.value})} />
              <input className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md outline-none focus:ring-1 focus:ring-blue-500" placeholder="LRC Author (by)" value={metadata.by} onChange={e => setMetadata({...metadata, by: e.target.value})} />
              <textarea className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-20" placeholder="Comments (one per line, exported as #...)" value={metadata.comments} onChange={e => setMetadata({...metadata, comments: e.target.value})} />
            </div>
          </div>

          <div className={`flex-1 flex flex-col ${mobilePanelType === 'tags' ? 'hidden md:flex' : ''}`}>
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">1. Paste Lyrics</h2>
            {showEditMode ? (
              <div className="flex flex-col gap-2 h-full">
                <textarea 
                  className="flex-1 w-full bg-gray-50 dark:bg-gray-800 rounded-md outline-none p-3 text-sm resize-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  placeholder="Paste raw text here..."
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                />
                <button
                  onClick={() => setShowEditMode(false)}
                  disabled={!rawText.trim()}
                  className={`px-4 py-2 rounded-md font-semibold text-sm transition ${rawText.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                  Load Lyrics
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditMode(true)}
                  className="px-4 py-2 rounded-md font-semibold text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Edit Lyrics
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                  {lines.length} lines loaded
                </span>
              </div>
            )}
          </div>

          <div className="hidden md:block bg-gray-100 dark:bg-gray-800/50 p-4 rounded-xl text-xs space-y-2">
            <div className="flex flex-wrap gap-2 text-gray-500 dark:text-gray-400">
              <p><kbd className="text-white dark:text-black bg-blue-700 dark:bg-blue-300 px-1 py-0.5 rounded shadow-sm border border-blue-200 dark:border-blue-600">Enter</kbd> or <kbd className="bg-white dark:bg-gray-700 px-1 py-0.5 rounded shadow-sm border border-gray-200 dark:border-gray-600">Tag</kbd> Tag time</p>
              <p><kbd className="bg-white dark:bg-gray-700 px-1 py-0.5 rounded shadow-sm border border-gray-200 dark:border-gray-600">Space</kbd> Play/Pause</p>
            </div>
          </div>
        </section>

        {/* Right pane: Audio player and tagger */}
        <section className="w-full md:flex-1 min-h-[58vh] md:min-h-0 flex flex-col relative bg-gray-50 dark:bg-transparent">
          
          {audioUrl && (
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex flex-wrap items-center justify-between gap-4 z-10 shadow-sm">
              <audio
                ref={playerRef}
                src={!isYouTube ? audioUrl : undefined}
                crossOrigin="anonymous"
                onTimeUpdate={(e) => {
                  if (!isYouTube) {
                    setCurrentTime(e.currentTarget.currentTime);
                    setDuration(e.currentTarget.duration);
                  }
                }}
                onLoadedMetadata={(e) => {
                  if (!isYouTube) {
                    setDuration(e.currentTarget.duration);
                  }
                }}
              />
              <button 
                onClick={handlePlayPause}
                className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full transition shadow-md shrink-0"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-1"/>}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={tagCurrent}
                  disabled={showEditMode || lines.length === 0}
                  className={`hidden md:inline-flex px-3 py-2 rounded-md text-sm font-semibold transition ${showEditMode || lines.length === 0 ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  Tag
                </button>
              </div>
              
              <div className="order-last md:order-none basis-full md:basis-auto md:flex-1 flex flex-col">
                <div className="flex justify-between text-xs mb-1 font-mono text-gray-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration || 0)}</span>
                </div>
                <div 
                  className="bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden cursor-pointer"
                  onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientX - rect.left) / rect.width;
                      const seekTime = ratio * (duration || 0);
                      if (isYouTube) {
                        seekYouTube(seekTime);
                      } else if (playerRef.current) {
                        playerRef.current.currentTime = seekTime;
                      }
                  }}
                >
                  <div 
                    className="bg-blue-600 h-full transition-all duration-75" 
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 font-mono">Speed</span>
                <select 
                  value={playbackRate} 
                  onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                  disabled={isYouTube}
                  className={`bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md outline-none ${isYouTube ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => <option key={r} value={r}>{r}x</option>)}
                </select>
              </div>

              <div className="w-full md:hidden flex items-center gap-2">
                <button
                  onClick={tagCurrent}
                  disabled={showEditMode || lines.length === 0}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold transition ${showEditMode || lines.length === 0 ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  Tag
                </button>
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 text-lg md:text-xl leading-relaxed space-y-4">
            <div
              id="yt-player"
              className={`w-full mb-6 rounded-lg overflow-hidden shadow-lg bg-black ${isYouTube ? 'block' : 'hidden'}`}
              style={{ height: isYouTube ? '400px' : '0px', maxWidth: '100%' }}
            />
            
            {!showEditMode && !lines.length && (
              <div className="h-full flex items-center justify-center text-gray-400">
                Load lyrics to begin tagging →
              </div>
            )}
            
            {lines.map((l, i) => {
              const lastTaggedLine = lineTagHistory.length > 0 ? lineTagHistory[lineTagHistory.length - 1] : null;
              const isLastTaggedLine = formatMode === 'A1' && lastTaggedLine === i;
              const lastTaggedWord = wordTagHistory.length > 0 ? wordTagHistory[wordTagHistory.length - 1] : null;
              return (
              <div key={i} className="flex items-stretch gap-3">
                <div
                  className={`w-[110px] shrink-0 font-mono text-sm tracking-wide self-stretch flex items-center px-2 rounded
                    ${l.time !== null ? 'text-blue-600 dark:text-blue-400 font-semibold opacity-100 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40' : 'text-gray-400 dark:text-gray-600'}`}
                  onClick={() => {
                    if (l.time === null) return;
                    if (isYouTube) {
                      seekYouTube(l.time);
                    } else if (playerRef.current) {
                      playerRef.current.currentTime = l.time;
                    }
                    setIsPlaying(true);
                  }}
                  title={l.time !== null ? 'Jump to this timestamp' : undefined}
                >
                  {l.time !== null ? `[${formatTime(l.time)}]` : '[--:--.--]'}
                </div>

                <div 
                  className={`flex-1 p-3 rounded-xl transition-all border-2 ${formatMode === 'A1' ? 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/10' : ''}
                    ${isLastTaggedLine ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 active-tag scale-[1.01] shadow-sm' : ''}
                    ${!isLastTaggedLine ? 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/50' : ''}`}
                  onClick={() => {
                    if (formatMode === 'A1') {
                      tagLineAtCurrentTime(i);
                      return;
                    }
                    setActiveIndex({ line: i, word: 0 });
                  }}
                >
                  {formatMode === 'A1' ? (
                    <span className={`font-medium ${l.time !== null ? 'opacity-100 text-gray-900 dark:text-gray-100' : 'opacity-60 text-gray-500 dark:text-gray-400'}`}>
                      {l.text}
                    </span>
                  ) : (
                    <span className="font-medium">
                      {l.words.map((w, wi) => {
                        const hasTime = w.time !== null;
                        const isLastTaggedWord = lastTaggedWord && lastTaggedWord.line === i && lastTaggedWord.word === wi;
                        return (
                          <span 
                            key={wi}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveIndex({ line: i, word: wi });
                            }}
                            className={`inline-block px-1 rounded-md mr-1 cursor-pointer transition-all
                              ${isLastTaggedWord ? 'bg-purple-500 text-white shadow-md active-tag -translate-y-[1px]' : ''}
                              ${hasTime && !isLastTaggedWord ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30' : ''}
                              ${!hasTime && !isLastTaggedWord ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700' : ''}
                            `}
                          >
                            {w.text}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
