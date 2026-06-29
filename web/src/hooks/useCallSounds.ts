import { useEffect, useRef } from 'react';
import type { CallStatus } from '../types/call';

const SOUND_PATHS = {
  ringtone: '/sounds/ringtone.mp3',
  dialtone: '/sounds/dialtone.mp3',
  connect: '/sounds/connect.mp3',
  disconnect: '/sounds/disconnect.mp3',
  tap: '/sounds/tap.mp3',
} as const;

type SoundName = keyof typeof SOUND_PATHS;

/**
 * Plays the correct looping/one-shot sound for each call lifecycle stage.
 *
 * - isIncoming + 'ringing'   -> looping ringtone (receiver side)
 * - !isIncoming + 'ringing'  -> looping dialtone (caller side, "calling out")
 * - 'connected' (on entry)   -> one-shot connect chime
 * - 'disconnected' / 'failed' (on entry) -> one-shot disconnect tone
 */
export function useCallSounds(status: CallStatus, isIncoming: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevStatusRef = useRef<CallStatus | null>(null);

  const stopLoop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  const playOneShot = (name: SoundName, volume = 0.6) => {
    const audio = new Audio(SOUND_PATHS[name]);
    audio.volume = volume;
    audio.play().catch(() => {
      // Autoplay can be blocked until the user interacts with the page once.
      // This is expected on first load in some browsers — not a bug to fix here.
    });
  };

  const playLoop = (name: SoundName, volume = 0.5) => {
    stopLoop();
    const audio = new Audio(SOUND_PATHS[name]);
    audio.loop = true;
    audio.volume = volume;
    audio.play().catch(() => {});
    audioRef.current = audio;
  };

  useEffect(() => {
    const prevStatus = prevStatusRef.current;

    if (status === 'ringing') {
      playLoop(isIncoming ? 'ringtone' : 'dialtone');
    } else {
      stopLoop();
    }

    if (status === 'connected' && prevStatus !== 'connected') {
      playOneShot('connect', 0.5);
    }

    if ((status === 'disconnected' || status === 'failed') && prevStatus !== status) {
      playOneShot('disconnect', 0.5);
    }

    prevStatusRef.current = status;

    return () => stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isIncoming]);

  // Cleanup on unmount
  useEffect(() => stopLoop, []);

  return {
    playTap: () => playOneShot('tap', 0.4),
  };
}
