"use client";

import { Music2, VolumeX } from "lucide-react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

const MUSIC_ENABLED_KEY = "edward-jessica-music-enabled";
const MUSIC_TIME_KEY = "edward-jessica-music-time";

type BackgroundMusicContextValue = {
  hasMusic: boolean;
  isPlaying: boolean;
  pause: () => void;
  play: () => void;
  register: (src?: string | null) => void;
};

const BackgroundMusicContext =
  createContext<BackgroundMusicContextValue | null>(null);

function getStoredValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeStoredValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Playback should still work in browsers that block storage.
  }
}

function setStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Playback should still work in browsers that block storage.
  }
}

export function GuestMusicProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastStoredSecondRef = useRef(0);
  const [src, setSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    removeStoredValue(MUSIC_ENABLED_KEY);
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      audio.load();
    }
    void audio
      .play()
      .then(() => {
        setStoredValue(MUSIC_ENABLED_KEY, "1");
        setIsPlaying(true);
      })
      .catch(() => {
        removeStoredValue(MUSIC_ENABLED_KEY);
        setIsPlaying(false);
      });
  }, [src]);

  const register = useCallback((nextSrc?: string | null) => {
    if (!nextSrc) return;
    setSrc((current) => current || nextSrc);
  }, []);

  useEffect(() => {
    if (!src) return;
    if (getStoredValue(MUSIC_ENABLED_KEY) === "1") {
      play();
    }
  }, [play, src]);

  const value = useMemo(
    () => ({
      hasMusic: Boolean(src),
      isPlaying,
      pause,
      play,
      register,
    }),
    [isPlaying, pause, play, register, src],
  );

  const showToggle = Boolean(src) && !pathname?.startsWith("/admin");

  return (
    <BackgroundMusicContext.Provider value={value}>
      {children}
      {src ? (
        <audio
          data-background-music
          loop
          onLoadedMetadata={(event) => {
            const storedTime = Number(getStoredValue(MUSIC_TIME_KEY));
            const audio = event.currentTarget;
            if (
              Number.isFinite(storedTime) &&
              storedTime > 0 &&
              storedTime < audio.duration
            ) {
              audio.currentTime = storedTime;
            }
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={(event) => {
            const currentSecond = Math.floor(event.currentTarget.currentTime);
            if (currentSecond - lastStoredSecondRef.current < 5) return;
            lastStoredSecondRef.current = currentSecond;
            setStoredValue(MUSIC_TIME_KEY, String(currentSecond));
          }}
          preload="metadata"
          ref={audioRef}
          src={src}
        />
      ) : null}
      {showToggle ? (
        <button
          aria-label={isPlaying ? "Pause music" : "Play music"}
          className={`music-toggle ${isPlaying ? "is-playing" : ""}`}
          onClick={() => {
            if (isPlaying) {
              pause();
              return;
            }
            play();
          }}
          title={isPlaying ? "Pause music" : "Play music"}
          type="button"
        >
          {isPlaying ? <VolumeX size={19} /> : <Music2 size={19} />}
        </button>
      ) : null}
    </BackgroundMusicContext.Provider>
  );
}

export function RegisterBackgroundMusic({ src }: { src?: string | null }) {
  const { register } = useBackgroundMusic();
  useEffect(() => {
    register(src);
  }, [register, src]);
  return null;
}

export function useBackgroundMusic() {
  const context = useContext(BackgroundMusicContext);
  if (!context) {
    return {
      hasMusic: false,
      isPlaying: false,
      pause: () => undefined,
      play: () => undefined,
      register: () => undefined,
    };
  }
  return context;
}
